const { ipcRenderer } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
import { Alert } from "./funcs/alert.js";

document.addEventListener('DOMContentLoaded', () => {
    const fileList = document.getElementById('file-list');
    const breadcrumbs = document.getElementById('breadcrumbs');
    let currentDir = 'C:/';
    let selectedPaths = [];

    const minimize = () => {
        ipcRenderer.invoke('minimize');
    }

    const minimzeMaximize = () => {
        ipcRenderer.invoke('minimize-maximize');
    }

    const closeApp = () => {
        ipcRenderer.invoke('close-app');
    }

    document.getElementById('minimize-btn').addEventListener('click', minimize);
    document.getElementById('minimizemaximize-btn').addEventListener('click', minimzeMaximize);
    document.getElementById('close-btn').addEventListener('click', closeApp);

    async function loadFiles(directory) {
        currentDir = directory;
        updateBreadcrumbs(directory);

        const files = await getDirectoryContents(directory);
        fileList.innerHTML = '';

        files.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = 'tab-column';
            fileElement.setAttribute('data-path', file.path);

            const icon = document.createElement('i');
            icon.className = file.isDirectory ? 'fas fa-folder fa-2x' : 'fas fa-file fa-2x';
            fileElement.appendChild(icon);

            const fileName = document.createElement('span');
            fileName.innerText = file.name;
            fileElement.appendChild(fileName);

            fileElement.addEventListener('dblclick', async () => {
                if (file.isDirectory) {
                    loadFiles(file.path);
                } else {
                    await exec(`start "" "${file.path}"`).catch((err) => {
                        console.error(err);
                        new Alert().ShowAlert({
                            icon: 'error',
                            title: "Error",
                            text: err
                        });
                    });
                }
            });

            fileElement.addEventListener('click', () => {
                if (event.ctrlKey) {
                    fileElement.classList.toggle('selected');
                    if (fileElement.classList.contains('selected')) {
                        selectedPaths.push(fileElement.getAttribute('data-path'));
                    } else {
                        selectedPaths = selectedPaths.filter(path => path !== fileElement.getAttribute('data-path'));
                    }
                    return;
                } else if (event.shiftKey) {
                    const selected = document.querySelector('.tab-column.selected');
                    console.log(selected);
                    if (selected) {
                        const files = Array.from(document.querySelectorAll('.tab-column'));
                        const startIndex = [...files].indexOf(selected);
                        const endIndex = [...files].indexOf(fileElement);
                        const selection = files.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
                        selection.forEach(file => file.classList.add('selected'));
                        selectedPaths = selection.map(file => file.getAttribute('data-path'));
                    }
                } else {
                    const selected = document.querySelectorAll('.tab-column.selected');
                    if (selected) {
                        selected.forEach(file => file.classList.remove('selected'));
                        fileElement.classList.add('selected');
                        selectedPaths = [fileElement.getAttribute('data-path')];
                    } else {
                        fileElement.classList.add('selected');
                        selectedPaths = [fileElement.getAttribute('data-path')];
                    }
                }

                document.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('tab-column')) {
                        const selected = document.querySelectorAll('.tab-column.selected');
                        selected.forEach(file => file.classList.remove('selected'));
                        selectedPaths = [];
                    }
                });
            });

            if (!file.isDirectory && isImage(file.name)) {
                fileElement.setAttribute('data-file-path', file.path);
                fileElement.setAttribute('data-file-name', file.name);

                const filePreview = document.createElement('div');
                filePreview.className = 'file-preview';
                fileElement.appendChild(filePreview);
            }

            fileList.appendChild(fileElement);
        });

        lazyLoadImages();
    }

    function isImage(fileName) {
        const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
        return imageFormats.includes(fileName.split('.').pop().toLowerCase());
    }

    function lazyLoadImages() {
        const fileElements = document.querySelectorAll('.tab-column[data-file-path]');

        const observer = new IntersectionObserver((entries, observer) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const fileElement = entry.target;
                    const filePath = fileElement.getAttribute('data-file-path');
                    const fileName = fileElement.getAttribute('data-file-name');
                    const filePreview = fileElement.querySelector('.file-preview');

                    if (filePreview) {
                        setTimeout(() => {

                            const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
                            filePreview.style.backgroundImage = `url("data:image/${fileName.split('.').pop().toLowerCase()};base64,${base64}")`;

                            observer.unobserve(fileElement);
                        }, 100);
                    }
                }
            }
        });

        fileElements.forEach(fileElement => {
            observer.observe(fileElement);
        });
    }


    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (target.classList.contains('tab-column') || target.parentElement.classList.contains('tab-column')) {
            const elementDir = target.getAttribute('data-path') || target.parentElement.getAttribute('data-path');
            e.preventDefault();
            ipcRenderer.invoke('show-context-menu', elementDir);
        } else {
            e.preventDefault();
            ipcRenderer.invoke('show-context-menu', currentDir);
        }
    });

    ipcRenderer.on('context-menu-command', async (event, data) => {
        const { action, filePath } = data;
        if (action === 'copy') {
            console.log(selectedPaths);
            if (selectedPaths.length === 0) {
                localStorage.setItem('clipboard', filePath);
                localStorage.setItem('operation', 'copy');
            } else {
                localStorage.setItem('clipboard', JSON.stringify(selectedPaths));
                localStorage.setItem('operation', 'copy');
            }
        } else if (action === 'paste') {
            let clipboardPath = localStorage.getItem('clipboard');
            let operation = localStorage.getItem('operation');

            if (clipboardPath && operation) {
                if (Array.isArray(JSON.parse(clipboardPath))) {
                    clipboardPath = JSON.parse(clipboardPath);
                    clipboardPath.forEach(async (path_) => {
                        const destination = path.join(currentDir, path.basename(path_));
                        const scriptPath = path.join(__dirname, 'copy-script.ps1');
                        const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Source "${path_}" -Destination "${destination}"`;
                        console.log(command);
                        showModal();
                        await executeCommand(command).then(() => {
                            loadFiles(currentDir);
                            closeModal();
                            new Alert().ShowAlert({
                                icon: 'success',
                                title: "Success",
                                text: `Copied ${path_} to ${destination}`
                            });
                        }).catch((err) => {
                            closeModal();
                            new Alert().ShowAlert({
                                icon: 'error',
                                title: "Error",
                                text: err
                            });
                        });
                    });
                } else {
                    const destination = path.join(currentDir, path.basename(clipboardPath));
                    const scriptPath = path.join(__dirname, 'copy-script.ps1');
                    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Source "${clipboardPath}" -Destination "${destination}"`;
                    console.log(command);
                    showModal();
                    await executeCommand(command).then(() => {
                        loadFiles(currentDir);
                        closeModal();
                        new Alert().ShowAlert({
                            icon: 'success',
                            title: "Success",
                            text: `Copied ${clipboardPath} to ${destination}`
                        });
                    }).catch((err) => {
                        closeModal();
                        new Alert().ShowAlert({
                            icon: 'error',
                            title: "Error",
                            text: err
                        });
                    });
                }
            }
        } else if (action === 'delete') {
            if (!selectedPaths.length) {
                const command = `rd /s /q "${filePath}"`;
                await executeCommand(command).then(() => {
                    loadFiles(currentDir);
                    new Alert().ShowAlert({
                        icon: 'success',
                        title: "Success",
                        text: `Deleted ${filePath}`
                    });
                }).catch((err) => {
                    console.log(err);
                    new Alert().ShowAlert({
                        icon: 'error',
                        title: "Error",
                        text: err
                    });
                });
            } else {
                selectedPaths.forEach(async (path_) => {
                    const command = `rd /s /q "${path_}"`;
                    await executeCommand(command).then(() => {
                        loadFiles(currentDir);
                        new Alert().ShowAlert({
                            icon: 'success',
                            title: "Success",
                            text: `Deleted ${path_}`
                        });
                    }).catch((err) => {
                        console.log(err);
                        new Alert().ShowAlert({
                            icon: 'error',
                            title: "Error",
                            text: err
                        });
                    });
                });
            }
        }
    });

    function updateBreadcrumbs(directory) {
        const parts = directory.split(path.sep);
        breadcrumbs.innerHTML = '';
        parts.forEach((part, index) => {
            const breadcrumb = document.createElement('span');
            breadcrumb.className = 'hover:underline cursor-pointer';
            breadcrumb.innerText = part || 'Root';
            breadcrumbs.value = directory;
            breadcrumb.addEventListener('click', () => {
                const newPath = parts.slice(0, index + 1).join(path.sep) || 'C:/';
                loadFiles(newPath);
            });
        });
    }

    loadFiles(currentDir);

    document.getElementById("back-btn").addEventListener("click", () => {
        const parts = currentDir.split(path.sep);
        parts.pop();
        const newPath = parts.join(path.sep) || 'C:/';

        if (newPath === 'C:') {
            loadFiles('C:/');
            return;
        }

        loadFiles(newPath);
    });

    document.getElementById("forward-btn").addEventListener("click", () => {
        const parts = currentDir.split(path.sep);
        const newPath = parts.join(path.sep) || 'C:/';
        loadFiles(newPath);
    });

    document.getElementById("up-btn").addEventListener("click", () => {
        loadFiles('C:/');
    });

    document.getElementById("breadcrumbs").addEventListener("keydown", (e) => {
        if (e.key === 'Enter') {
            const newPath = e.target.value;
            loadFiles(newPath);
        }
    });

    document.getElementById("breadcrumbs").addEventListener("mouseenter", (e) => {
        e.target.classList.add("big");
    });

    document.getElementById("breadcrumbs").addEventListener("mouseleave", (e) => {
        e.target.classList.remove("big");
    });
});

const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        const process = exec(command);

        process.stdout.on('data', (data) => {
            console.log(data.toString());
            updateProgress(data.toString());
        });

        process.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        process.on('exit', (code) => {
            if (code === 0 || code === 1) {
                resolve(`Process exited with code ${code}`);
            } else {
                reject(`Process exited with code ${code}`);
            }
        });
    });
}

const getDirectoryContents = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
            if (err) {
                console.error(err);
                reject(err);

                if (err.code === 'EPERM') {
                    new Alert().ShowAlert({
                        icon: 'error',
                        title: "Permission denied",
                        text: `You don't have permission to access this directory`
                    });
                }
            } else {
                resolve(files.map(file => ({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    path: path.join(dirPath, file.name),
                })));
            }
        });
    });
}

function showModal() {
    document.getElementById('progress-modal').classList.add('is-active');
}

function closeModal() {
    document.getElementById('progress-modal').classList.remove('is-active');
}

function updateProgress(output) {
    if (!output) return;
    if (output.endsWith("%")) {
        const progress = output.match(/\d+/)[0];
        document.getElementById('progress-bar').value = progress.toString();
        document.getElementById('progress-text').innerText = `${progress}%`;
    }
}
