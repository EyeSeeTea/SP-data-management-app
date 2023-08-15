/** @format */

module.exports = {
    extends: [
        "react-app",
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:cypress/recommended",
    ],
    rules: {
        "no-console": "off",
        "@typescript-eslint/explicit-function-return-type": ["off"],
        "@typescript-eslint/no-unused-vars": [1, { argsIgnorePattern: "^_" }],
        "react/prop-types": "off",
        "no-unused-expressions": "warn",
        "@typescript-eslint/no-unused-expressions": "warn",
        "no-useless-concat": "off",
        "no-redeclare": "off",
        "no-use-before-define": "off",
        "no-debugger": "warn",
        "no-useless-constructor": "off",
        "default-case": "off",
        "array-callback-return": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/no-redeclare": "off",
        "@typescript-eslint/no-empty-function": "off",
        "react-hooks/exhaustive-deps": "warn",
    },
    plugins: ["cypress"],
    env: { "cypress/globals": true },
    parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
    },
    settings: {
        react: {
            pragma: "React",
            version: "16.6.0",
        },
    },
};
