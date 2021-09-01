module.exports = {
  root: true,
  env: {
    node: true
  },
  // parser: "@typescript-eslint/parser",
  // plugins: [
  //   "@typescript-eslint"
  // ],
  "extends": [
    "plugin:vue/essential",
    "@vue/standard",
    "@vue/typescript",
    // "eslint:recommended",
    // "plugin:@typescript-eslint/eslint-recommended",
    // "plugin:@typescript-eslint/recommended"
  ],
  // http://eslint.cn/docs/rules
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    indent: ["error", 2, {
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1,
      MemberExpression: 1,
      ignoreComments: false,
      ObjectExpression: 1,
      ImportDeclaration: 1,
      flatTernaryExpressions: false,
      FunctionDeclaration: {
        parameters: 1,
        body: 1
      }
    }],
    quotes: ["error", "double"],
    semi: ["error", "always", { "omitLastInOneLineBlock": true }],
    "space-before-function-paren": ["error", "never"]
  },
  parserOptions: {
    parser: "@typescript-eslint/parser"
  },
  overrides: [
    {
      files: [
        "**/__tests__/*.{j,t}s?(x)",
        "**/tests/unit/**/*.spec.{j,t}s?(x)"
      ],
      env: {
        jest: true
      }
    }
  ]
}
