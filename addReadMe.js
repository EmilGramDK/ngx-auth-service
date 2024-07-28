// move a copy of README.md to dist/lib
const fs = require("fs");

fs.copyFileSync("README.md", "dist/lib/README.md");
console.log("README.md copied to dist/lib");
