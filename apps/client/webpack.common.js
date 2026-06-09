const path = require("path");
const fs = require("fs");
const appDirectory = fs.realpathSync(process.cwd());
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: path.resolve(appDirectory, "src/index.ts"),
    output: {
        filename: "js/bundle.js",
        clean: true,
        path: path.resolve(__dirname, "dist/"),
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        fallback: {
            console: false,
            assert: false,
            util: false,
        },
        alias: {
            "@shared": path.resolve(__dirname, "../shared/src"),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                    options: {
                        //sourceMap: true,
                    },
                },
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "public/index.html",
            inject: "body",
            scriptLoading: "blocking",
        }),
        new CopyPlugin({
            patterns: [{ from: "public/", to: "./", globOptions: { ignore: ["**/index.html"] } }],
        }),
    ],
    mode: "development",
};
