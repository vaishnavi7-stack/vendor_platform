const fs = require("fs");
const path = require("path");

const file = path.join("outputs", "index.html");
const html = fs.readFileSync(file, "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/);
const script = html.match(/<script>([\s\S]*?)<\/script>/);

if (!style || !script) {
  throw new Error("Could not find inline style/script blocks");
}

const next = html
  .replace(style[0], '<link rel="stylesheet" href="styles.css" />')
  .replace(script[0], '<script src="app.js"></script>');

fs.writeFileSync(path.join("outputs", "styles.css"), style[1].trimStart(), "utf8");
fs.writeFileSync(path.join("outputs", "app.js"), script[1].trimStart(), "utf8");
fs.writeFileSync(file, next, "utf8");

console.log("split complete");
