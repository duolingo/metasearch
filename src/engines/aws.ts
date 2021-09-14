import * as RGT from "aws-sdk/clients/resourcegroupstaggingapi";

import { fuzzyIncludes, rateLimit } from "../util";

/** AWS console host */
const HOST = "console.aws.amazon.com";

/**
 * Mapping of ARN service names to friendly product names.
 *
 * TODO: Handle more AWS services
 */
const SERVICE_NAMES: Record<string, string> = {
  acm: "Certificate Manager",
  cloudformation: "CloudFormation",
  cloudfront: "CloudFront",
  cloudtrail: "CloudTrail",
  cloudwatch: "CloudWatch",
  datapipeline: "Data Pipeline",
  dynamodb: "DynamoDB",
  ec2: "EC2",
  elasticache: "ElastiCache",
  elasticbeanstalk: "Elastic Beanstalk",
  elasticloadbalancing: "ELB",
  elasticmapreduce: "EMR",
  es: "Elasticsearch",
  events: "CloudWatch",
  firehose: "Firehose",
  kinesis: "Kinesis",
  kms: "KMS",
  lambda: "Lambda",
  rds: "RDS",
  redshift: "Redshift",
  "resource-groups": "Resource Groups",
  route53: "Route 53",
  s3: "S3",
  secretsmanager: "Secrets Manager",
  sns: "SNS",
  sqs: "SQS",
  states: "Step Functions",
};

/** TODO: Handle more AWS services */
const RESOURCE_NAME_TO_URL: Record<
  string,
  (data: { arn: string; id: string[]; region: string }) => string
> = {
  cloudformation: ({ arn, region }) =>
    `${HOST}/cloudformation/home${region}#/stacks/stackinfo?stackId=${encodeURIComponent(
      arn,
    )}`,
  cloudfront: ({ id, region }) =>
    `${HOST}/cloudfront/home${region}#distribution-settings:${
      id[0].split("/")[1]
    }`,
  // TODO: Handle non-alarm CloudWatch resources
  cloudwatch: ({ id, region }) =>
    `${HOST}/cloudwatch/home${region}#alarmsV2:${id[0]}/${id[1]}`,
  dynamodb: ({ id, region }) =>
    `${HOST}/dynamodb/home${region}#tables:selected=${id[0].split("/")[1]}`,
  ec2: ({ id: [resourceId], region }) => {
    const base = `${HOST}/ec2/v2/home${region}`;
    const [type, id] = resourceId.split("/");
    switch (type) {
      case "image":
        return `${base}#Images:vimageId=${id}`;
      case "instance":
        return `${base}#Instances:instanceId=${id}`;
      case "network-interface":
        return `${base}#NIC:networkInterfaceId=${id}`;
      case "security-group":
        return `${base}#SecurityGroup:groupId=${id}`;
      case "snapshot":
        return `${base}#Snapshots:snapshotId=${id}`;
      case "spot-instances-request":
        return `${HOST}/ec2sp/v2/home${region}#/spot/${id}`;
      case "volume":
        return `${base}#Volumes:volumeId=${id}`;
      // TODO: Handle more EC2 resource types
      default:
        return base;
    }
  },
  // Can't link to individual resources because there's no way to tell from the
  // ARN whether a cluster is Memcached vs. Redis
  elasticache: ({ region }) => `${HOST}/elasticache/home${region}`,
  // TODO: Handle non-cluster EMR resources
  elasticmapreduce: ({ id, region }) =>
    `${HOST}/elasticmapreduce/home${region}#cluster-details:${
      id[0].split("/")[1]
    }`,
  elasticloadbalancing: ({ arn, id: [resourceId], region }) => {
    const base = `${HOST}/ec2/v2/home${region}`;
    const [type, ...id] = resourceId.split("/");
    switch (type) {
      case "loadbalancer":
        return `${base}#LoadBalancers:search=${id.join("/")}`;
      case "targetgroup":
        return `${base}#TargetGroup:targetGroupArn=${arn}`;
      // TODO: Handle more EMR resource types
      default:
        return base;
    }
  },
  kinesis: ({ id, region }) =>
    `${HOST}/kinesis/home${region}#/streams/details/${id[0].split("/")[1]}`,
  kms: ({ id, region }) =>
    `${HOST}/kms/home${region}#/kms/keys/${id[0].split("/")[1]}/`,
  lambda: ({ id, region }) =>
    `${HOST}/lambda/home${region}#/functions/${id[1]}`,
  rds: ({ id: [type, ...idPieces], region }) => {
    const base = `${HOST}/rds/home${region}`;
    switch (type) {
      case "cluster":
      case "cluster-pg":
        return `${base}#database:id=${idPieces[0]};is-cluster=true`;
      case "db":
        return `${base}#database:id=${idPieces[0]};is-cluster=false`;
      case "snapshot":
        return `${base}#db-snapshot:id=${idPieces[0]}`;
      // TODO: Handle more RDS resource types
      default:
        return base;
    }
  },
  route53: ({ id: [resourceId], region }) => {
    const base = `${HOST}/route53/`;
    const [type, id] = resourceId.split("/");
    switch (type) {
      case "healthcheck":
        return `${base}healthchecks/home${region}#/details/${id}`;
      case "hostedzone":
        return `${base}home#resource-record-sets:${id}`;
      default:
        return base;
    }
  },
  s3: ({ id: [bucket], region }) => `s3.${HOST}/s3/buckets/${bucket}/${region}`,
  // The entire SQS console lives at this single URL lol?
  sqs: ({ region }) => `${HOST}/sqs/home${region}`,
};

const serviceToUrl = (s: string) =>
  RESOURCE_NAME_TO_URL[s] ?? (() => `${HOST}/console/home`);

let getResources: (() => Promise<Set<Result>>) | undefined;

const engine: Engine = {
  id: "aws",
  init: ({ region: regions }: { region: string }) => {
    getResources = rateLimit(async () => {
      const resources: Result[] = [];
      const start = Date.now();
      await Promise.all(
        regions.split(",").map(async region => {
          const client = new RGT({ region });
          let token: string | undefined;
          do {
            const {
              PaginationToken,
              ResourceTagMappingList = [],
            } = await client
              .getResources({ PaginationToken: token, ResourcesPerPage: 100 })
              .promise();
            token = PaginationToken;
            resources.push(
              ...ResourceTagMappingList.map(r => {
                if (!r.ResourceARN) {
                  throw Error("Missing ARN");
                }

                /**
                 * ["arn", "aws", service, region, accountId, ...resourceName]
                 *
                 * https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
                 */
                const arnPieces = r.ResourceARN.split(":");
                const resourceIdPieces = arnPieces.slice(5);
                const serviceName = SERVICE_NAMES[arnPieces[2]];
                return {
                  snippet: [
                    `ARN = ${r.ResourceARN}`,
                    ...(r.Tags ?? [])
                      .sort((a, b) => (a.Key > b.Key ? 1 : -1))
                      .map(r => `${r.Key} = ${r.Value}`),
                  ].join("<br>"),
                  title:
                    (serviceName ? `${serviceName}: ` : "") +
                    resourceIdPieces.join(":"),
                  url: `https://${serviceToUrl(arnPieces[2])({
                    arn: r.ResourceARN,
                    id: resourceIdPieces,
                    region: `?region=${region}`,
                  })}`,
                };
              }),
            );
          } while (token);
        }),
      );
      console.log(
        `Scraped ${resources.length} AWS resources in ${
          (Date.now() - start) / 1000
        }s`,
      );
      return new Set(resources);
    }, 4);
  },
  name: "AWS",
  search: async q => {
    if (!getResources) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getResources())
      .filter(r => fuzzyIncludes(r.snippet, q))
      .sort((a, b) => ((a.snippet ?? "") > (b.snippet ?? "") ? 1 : -1));
  },
};

export default engine;
