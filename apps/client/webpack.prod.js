const { merge } = require("webpack-merge");
const webpack = require("webpack");
const common = require("./webpack.common.js");

module.exports = merge(common, {
    mode: "production",
    devtool: "source-map",
    plugins: [
        new webpack.DefinePlugin({
            "process.env.VITE_SERVER_URL": JSON.stringify(process.env.VITE_SERVER_URL ?? ""),
        }),
    ],
});
