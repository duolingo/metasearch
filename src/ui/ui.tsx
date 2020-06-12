// Can't use import/require in this source file since its compiled JS is loaded
// directly into the browser

const App = () => <p>Hi world</p>;

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
