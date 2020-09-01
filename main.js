const inputElement = document.getElementById("fileInput");
const progressBar = document.getElementById("progress-bar");
const transferPopup = document.getElementById("transferPopup");
const transferPercentage = document.getElementById("transfer-percentage");
const transferPopupClose = document.getElementById("close");
const transferPopupHeading = document.getElementById("popup-process");
const fileManager = document.getElementById("manager");

/* Event listener to handle closure of upload/download popup windows */
transferPopupClose.addEventListener("click", () => {
    document.getElementById("transferPopup").style.display = "none";
});

let activeFileID = 0;
let activeStorageID = 0;

async function main()
{
    let mtpDevice = await MTPDeviceInit();
    let fileObjects = null;

    let storageObjects = await getStorageIDS(mtpDevice);
    console.log(storageObjects);

    activeStorageID = storageObjects[0].storageID;
    fileObjects = await getFileObjects(mtpDevice, activeStorageID)
    console.log(fileObjects);

    refreshUI(fileObjects, storageObjects[0]);
}

function refreshUI(fileObjects, storageObject)
{
    addFilesToUI(fileObjects);
    showStorageInfo(storageObject);
}

async function downloadAsFile()
{
    /* Show download popup and initialize */
    transferPopup.style.display = "block";
    transferPopupClose.style.display = "none";
    transferPopupHeading.innerText = "Downloading";

    /* Fetch file from MTP Device */
    let fileArray = await downloadFile(device, 1, 2, progressBar);
    let file_ = Uint8Array.from(fileArray);
    let fileBlob = new Blob([file_]);

    /* Creating URL for file object and initiating download */
    let url = window.URL.createObjectURL(fileBlob);
    const file_element = document.createElement("a");
    file_element.href = url;
    let filename = "README.txt";
    file_element.download = filename.split("\n")[0];
    file_element.click();

    /* Enable the user to press the close button for the popup */
    transferPopupClose.style.display = "block";
    transferPopupHeading.innerText = "Download Complete";
}

async function openAsText()
{
    /* Show download popup and initialize */
    transferPopup.style.display = "block";
    transferPopupClose.style.display = "none";
    transferPopupHeading.innerText = "Downloading";

    let fileArray = await downloadFile(device, activeStorageID, activeFileID, progressBar);
    document.getElementById("text-area").value = bin2String(fileArray);
    document.getElementById("transferPopup").style.display = "none";

    /* Enable the user to press the close button for the popup */
    transferPopupClose.style.display = "block";
    transferPopupHeading.innerText = "Download Complete";
}

async function deleteFile()
{
    await deleteObject(device, activeStorageID, activeFileID);
    await getFileObjects(device, activeStorageID);
}

async function closeDevice()
{
    await disconnect(device);
}

inputElement.oninput = function (event)
{
    let fileList = inputElement.value;
    console.log(fileList);
    if (fileList != null)
    {
        let file = this.files[0];
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = function()
        {
            let arrayBuffer = reader.result;
            let bytes = new Uint8Array(arrayBuffer);
            uploadFile(device, 1, file, bytes, progressBar).then(() => {});
        }
    }
}

function addFilesToUI(fileObjects)
{
    for (let fileObject of fileObjects)
    {
        /* Create HTML elements to display File, File Size and context menu. */
        let fileElement = document.createElement("div");
        let fileSizeElement = document.createElement("div");
        let contextMenu = document.createElement("div");

        fileManager.appendChild(fileElement);
        fileManager.appendChild(contextMenu);
        fileManager.appendChild(fileSizeElement);

        fileElement.innerHTML = fileObject.fileName;
        contextMenu.innerHTML = '<div class="context-menu"> <div class="item"> <i class="fa fa-download"></i> Download </div> <div class="item"> <i class="fa fa-folder-open"></i> Open as text.. </div> <div class="item"> <i class="fa fa-trash-o"></i> Delete </div> </div>';

        contextMenu.id = 'context-menu-' + fileObject.fileID.toString();
        fileElement.id = fileObject.fileID.toString();

        fileElement.className = "file";
        activeFileID = fileObject.fileID;

        let downloadOption = contextMenu.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[0];
        let openAsTextOption = contextMenu.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[1];
        let deleteOption = contextMenu.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[2];

        downloadOption.addEventListener("click", function(e){downloadAsFile().then(() => {})});
        openAsTextOption.addEventListener("click", function(e){openAsText().then(() => {})});
        deleteOption.addEventListener("click", function(e){deleteFile().then(() => {})});

        fileElement.addEventListener("click", function(e)
        {
            /* Removing active file highlight and/or to hide context menu */
            document.getElementById(activeFileID.toString()).classList.remove("active");

            let currentFileElement = document.getElementById(this.id);
            currentFileElement.classList.add("active");
            /* ??? */ document.getElementById("context-menu-" + activeFileID.toString()).getElementsByClassName("context-menu")[0].classList.remove("active");
            activeFileID = parseInt(this.id);
        });

        fileElement.addEventListener("contextmenu",function(event)
        {
            event.preventDefault();
            let contextMenu = document.getElementById("context-menu-" + this.id.toString());
            let contextElement = contextMenu.getElementsByClassName("context-menu")[0];
            document.getElementById("context-menu-" + activeFileID.toString()).getElementsByClassName("context-menu")[0].classList.remove("active");

            let current_element = document.getElementById(this.id);
            document.getElementById(activeFileID.toString()).classList.remove("active");
            current_element.classList.add("active");
            activeFileID = parseInt(this.id);

            if ((event.pageY + 100) > window.innerHeight)
            {
                contextElement.style.top = (event.pageY - 100)  + "px";
            }
            else
            {
                contextElement.style.top = event.pageY + "px";
            }
            if ((event.pageX + 150) > document.getElementById("manager").clientWidth)
            {
                contextElement.style.left = (event.pageX - 150)+ "px";
            }
            else
            {
                contextElement.style.left = event.pageX + "px";
            }
            contextElement.classList.add("active");
        });
    }
}

function showStorageInfo(storageObject)
{

    let storage_info_div = document.getElementById("storage-info");

    let freeSpace = storageObject.freeSpace;
    let storageSize = storageObject.storageSize;

    if (storageSize > 1073741824)
    {
        storage_info_div.innerText = (freeSpace / (1024 * 1024 * 1024)).toString() + " GB free" + " / " + (storageSize / (1024 * 1024 * 1024)).toString() + " GB";
    } else
    {
        storage_info_div.innerText = (freeSpace / (1024 * 1024)).toString() + " MB free" + " / " + (storageSize / (1024 * 1024)).toString() + " MB";
    }
}