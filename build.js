const builder = require('electron-builder');

const { productname } = require('./package.json');
builder.build({
    config: {
        publish: [
            {
                provider: "github",
                owner: "1ly4s0",
                repo: "flashexplorer",
                releaseType: "release"
            }
        ],
        generateUpdatesFilesForAllChannels: true,
        appId: productname,
        productName: productname,
        artifactName: '${productName}-${os}-${arch}.${ext}',
        files: ["src/**/*", "package.json", "LICENSE.md"],
        directories: { "output": "dist" },
        compression: 'maximum',
        asar: true,
        win: {
            icon: "./src/assets/images/icons/icon.ico",
            target: [{
                target: "nsis",
                arch: ["x64", "ia32"]
            }]
        },
        nsis: {
            oneClick: false,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            runAfterFinish: true,
            multiLanguageInstaller: true,
            license: "./LICENSE.md",
        }
    }
}).then(() => {
    console.log('✅ El build se ha realizado correctamente.')
}).catch(err => {
    console.error('Error al realizar el build', err)
})