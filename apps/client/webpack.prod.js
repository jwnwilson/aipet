const { merge } = require("webpack-merge");
const webpack = require("webpack");
const common = require("./webpack.common.js");

module.exports = merge(common, {
    mode: "production",
    devtool: "source-map",
    output: {
        filename: "js/bundle.[contenthash:8].js",
    },
    plugins: [
        new webpack.DefinePlugin({
            "process.env.VITE_SERVER_URL": JSON.stringify(process.env.VITE_SERVER_URL ?? ""),
        }),
    ],
});
