// electron.vite.config.js
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "D:\\JiQingzhe\\R2APP";
var electron_vite_config_default = defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "electron/main/index.js")
        },
        external: ["@electron-toolkit/utils", "electron-store", "ali-oss", "@aws-sdk/client-s3", "@aws-sdk/lib-storage", "@aws-sdk/s3-request-presigner"]
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "electron/preload/index.mjs")
        },
        external: ["@electron-toolkit/preload"]
      }
    }
  },
  renderer: {
    root: ".",
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "index.html")
        }
      },
      assetsDir: "assets",
      assetsInlineLimit: 0,
      sourcemap: true
    },
    resolve: {
      alias: {
        "@": resolve("src/")
      }
    },
    plugins: [react()]
  }
});
export {
  electron_vite_config_default as default
};
