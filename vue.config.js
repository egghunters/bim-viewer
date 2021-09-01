// const path = require('path')
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
module.exports = {
  css: {
    requireModuleExtension: true
  },
  configureWebpack: () => ({
    resolve: {
      alias: {
      }
    },
    // Add package anylyze plugins
    // plugins: [new BundleAnalyzerPlugin()]
    optimization: {
      splitChunks: {
        cacheGroups: {
          common: {
            name: "chunk-common",
            chunks: "initial",
            minChunks: 2,
            maxInitialRequests: 5,
            minSize: 0,
            priority: 1,
            reuseExistingChunk: true,
            enforce: true
          },
          vendors: {
            name: "chunk-vendors",
            test: /[\\/]node_modules[\\/]/,
            chunks: "initial",
            priority: 2,
            reuseExistingChunk: true,
            enforce: true
          },
          elementUI: {
            name: "chunk-elementui",
            test: /[\\/]node_modules[\\/]element-ui[\\/]/,
            chunks: "all",
            priority: 3,
            reuseExistingChunk: true,
            enforce: true
          },
          threejs: {
            name: "chunk-threejs",
            test: /[\\/]three[\\/]/,
            chunks: "all",
            priority: 4,
            reuseExistingChunk: true,
            enforce: true
          },
          public: {
            name: "chunk-public",
            test: /[\\/]public[\\/]/,
            chunks: "all",
            priority: 4,
            reuseExistingChunk: true,
            enforce: true
          }
        }
      }
    },
    devServer: {
      disableHostCheck: true
    }
  })
};
