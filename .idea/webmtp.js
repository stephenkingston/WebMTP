
var connectionStatus = 0;
var my_device = null;
var receivedBuffer = new Uint8Array(512);
var storage_id = new Uint32Array(2);
var storage_info_objects = new Array(0);
var activeStorageIndex = 0;
var file_object_id = new Array(4);
var file_object_info = new Uint32Array(4);
var file_list = new Array(0);
var file_size_list = new Array(0);
var file_length = null;
var file_buffer = new Array(0);
var activeFileIndex = 0;
var file_blob = null;
var bytes_to_send = null;
var currentCallback = checkIfOK;

/* Temporary variables */
var get_object_id_done = false;
var get_object_id_mtp_ok = false;
var get_object_info_done = false;
var get_object_info_mtp_ok = false;
var get_object_done = false;
var get_object_mtp_ok = false;
var get_objectInfoResponse_mtp_ok = false;
var get_objectInfoResponse_done = false;

/* Container Type */
const CONTAINER_TYPE_UNDEFINED = 0x0000;
const CONTAINER_TYPE_COMMAND = 0x0001;
const CONTAINER_TYPE_DATA = 0x0002;
const CONTAINER_TYPE_RESPONSE = 0x0003;
const CONTAINER_TYPE_EVENT = 0x0004;

/* Operation Codes */
const OPEN_SESSION = 0x1002;
const GET_STORAGE_IDS = 0x1004;
const GET_STORAGE_INFO = 0x1005;
const GET_OBJECT_HANDLES = 0x1007;
const GET_OBJECT_INFO = 0x1008;
const GET_OBJECT = 0x1009;
const CLOSE_SESSION = 0x1003;
const DELETE_OBJECT = 0x100B;
const SEND_OBJECT_INFO = 0x100C;
const SEND_OBJECT = 0x100D;

/* Object formats */
const OBJECT_FORMAT_TEXT = 0x3004;
const GET_ROOT_OBJECTS = 0xFFFFFFFF;
const UNDEFINED_OBJECT_FORMAT = 0x3000;

/* Other constants */
const FILE_NAME_START = 65
const LINE_FEED = 0x10;
var gotFileInfo = false;
var objectInfoActiveIndex = 0;
const ENDPOINT_IN = 1
const ENDPOINT_OUT = 2
const DOWNLOAD = 1
const OPEN_AS_TEXT = 2
const DELETE = 3
var CONTEXT_MENU_OPTION = 1

try
{
    window.addEventListener("click",function()
    {
        document.getElementById("context-menu-"+ activeFileIndex.toString()).getElementsByClassName("context-menu")[0].classList.remove("active");
        document.getElementById("text-editor").classList.remove("sidePanelOpen");
    });

    document.getElementById("disconnectButton").disabled = true;
    document.getElementById("conButton").disabled = false;
    document.getElementById("uploadButton").disabled = true;
}
catch
{

}

function disconnect()
{
    discReq = new mtp_container(0);
    discReq.setOperation(CLOSE_SESSION);
    discReq.setTransactionType(CONTAINER_TYPE_COMMAND);
    discReq.setTransactionID(0x06);
    currentCallback = checkIfDisconnected;
    discReq.pack()
    sendContainer(discReq);
}

function sendContainer(container)
{
    my_device.transferOut(ENDPOINT_OUT, container.container_array);
}

function checkIfDisconnected()
{
    if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === 0x2001)
    {
        receivedBuffer = null;
        document.getElementById("disconnectButton").disabled = true;
        document.getElementById("uploadButton").disabled = true;
        document.getElementById("conButton").disabled = false;
        document.getElementById("conButton").innerText = "Connect";
    }
}



let readLoop = () => {
    my_device.transferIn(ENDPOINT_IN, 512).then(result => {
        receivedBuffer = new Uint8Array(result.data.buffer);
    }, error => {
        console.log(error);
    }).then(()=> {
        currentCallback();
        readLoop();
    });
};

var checkIfOK = function()
{
    if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === 0x2001)
    {
        document.getElementById("conButton").innerText = "Connected";
        document.getElementById("disconnectButton").disabled = false;
        document.getElementById("uploadButton").disabled = false;
        document.getElementById("conButton").disabled = true;
    }
    else if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === 0x201E)
    {
        receivedBuffer = null;
        document.getElementById("conButton").innerText = "Connected";
        document.getElementById("disconnectButton").disabled = true;
        document.getElementById("uploadButton").disabled = false;
        document.getElementById("conButton").disabled = false;
    }
    receivedBuffer = null;
    requestStorageIDS();
}

var readStorageIDS = function()
{
    if (ResponseMTPOK())
    {

    }
    else
    {
        let text_box = document.getElementById("logger");

        let length = receivedBuffer[12] | (receivedBuffer[13] << 8) | (receivedBuffer[14] << 16) | (receivedBuffer [15] << 24);
        storage_id = new Uint32Array(length);
        storage_id.fill(0);
        let readBase = 16;
        for (let i = 0; i < length; i++)
        {
            storage_id[i] = receivedBuffer[readBase + (i * 4)] | receivedBuffer[(readBase + 1) + (i * 4)] << 8 | receivedBuffer[(readBase + 2) + (i * 4)] << 16 | receivedBuffer[(readBase + 3) + (i * 4)] << 24;
            storage_info_objects.push(new storageInfoDataset(storage_id[i]));
        }
        currentCallback = checkIfOK;
        receivedBuffer = null;
        requestObjectHandles();
    }
}

function ResponseMTPOK()
{
    return ((receivedBuffer[7] << 8 | receivedBuffer[6]) === 0x2001);
}

const requestObjectHandles = function()
{
    let reqObjHandles = new mtp_container(3);
    reqObjHandles.setTransactionID(0x02);
    reqObjHandles.setTransactionType(CONTAINER_TYPE_COMMAND);
    reqObjHandles.setOperation(GET_OBJECT_HANDLES);
    reqObjHandles.setParams(storage_id[activeStorageIndex], 0, GET_ROOT_OBJECTS,0, 0);
    reqObjHandles.pack();
    currentCallback = readObjectHandles;
    my_device.transferOut(ENDPOINT_OUT, reqObjHandles.container_array);
}

function requestUpload(fileName, bytes)
{
    reqSendObjectInfo(fileName, bytes);
}

function reqSendObjectInfo(fileObject, bytes)
{
    file_list.push(fileObject.name);
    file_size_list.push(fileObject.size);
    createFileElement(fileObject.name, file_list.length - 1);

    /* Setup popup */
    document.getElementById("process").innerText = "Uploading...";
    document.getElementById("process-filename").innerText = fileObject.name;
    document.getElementById("progress-bar").value = 0;
    document.getElementById("process-percentage").innerText = "0";
    document.getElementById("myPopup").style.display = "block";

    const PLACE_IN_ROOT = 0xFFFFFFFF;
    let sendObjInfo = new mtp_container(2);
    sendObjInfo.setOperation(SEND_OBJECT_INFO);
    sendObjInfo.setTransactionID(0x08);
    sendObjInfo.setTransactionType(CONTAINER_TYPE_COMMAND);
    sendObjInfo.setParams(storage_id[activeStorageIndex], PLACE_IN_ROOT, 0, 0, 0);
    sendObjInfo.pack();
    currentCallback = getObjectInfoSentResponse;
    receivedBuffer = null;
    my_device.transferOut(ENDPOINT_OUT, sendObjInfo.container_array);

    let fileInfo = new ObjectInfoDataset(fileObject);
    fileInfo.initContainer(UNDEFINED_OBJECT_FORMAT, bytes.length, 0, 0);

    let sendObjInfo2 = new mtp_container(0);
    sendObjInfo2.setOperation(SEND_OBJECT_INFO);
    sendObjInfo2.setTransactionID(0x08);
    sendObjInfo2.setParams(0, 0, 0, 0, 0);
    sendObjInfo2.setTransactionType(CONTAINER_TYPE_DATA);
    sendObjInfo2.containerArrayLength = 12 + fileInfo.container_array.length + fileInfo.filename_array.length + fileInfo.dateModArray.length;
    sendObjInfo2.pack();

    my_device.transferOut(ENDPOINT_OUT, new Uint8Array([...sendObjInfo2.container_array, ...fileInfo.container_array, ...fileInfo.filename_array, ...fileInfo.dateModArray]));

    bytes_to_send = bytes;
}

const getObjectInfoSentResponse = function()
{
    if (ResponseMTPOK())
    {
        get_objectInfoResponse_mtp_ok = true;
        let newObjectID = 0;
        for (let i = 20; i < 24; i++)
        {
            newObjectID |= (receivedBuffer[i] >> (i-20) * 8) & 0xFF;
        }
        file_object_id.push(newObjectID);
        reqSendObject(bytes_to_send);
    }
    else
    {
        let lastCreatedFile = document.getElementById((file_list.length - 1).toString());
        lastCreatedFile.remove();
        file_list.pop();
        file_size_list.pop();
    }
}

function reqSendObject(file)
{

    let reqSendObject = new mtp_container(0);
    reqSendObject.setTransactionType(CONTAINER_TYPE_COMMAND);
    reqSendObject.setTransactionID(0x10);
    reqSendObject.setOperation(SEND_OBJECT);
    reqSendObject.setParams(0, 0, 0, 0, 0);
    reqSendObject.pack();
    currentCallback = confirmSentObject;
    sendContainer(reqSendObject);

    reqSendObject.setTransactionType(CONTAINER_TYPE_DATA);
    reqSendObject.containerArrayLength = file.length + 12;
    reqSendObject.pack();

    my_device.transferOut(ENDPOINT_OUT, reqSendObject.container_array);

    let end = 0;
    let i = 0;

    while (i < file.length)
    {
        if ((i + 512) > file.length)
        {
            end = file.length;
        }
        else
        {
            end = i + 512;
        }
        let slice = file.slice(i, end)
        my_device.transferOut(ENDPOINT_OUT, slice)
        i = i + 512;

        /* Update progress bar */
        let percentage = (end / file.length) * 100;
        updateProgressBar(percentage);

    }
}

function updateProgressBar(percentage)
{
    document.getElementById("process-percentage").innerText = percentage.toFixed(2).toString() + "%";
    document.getElementById("progress-bar").value = percentage;
}

const confirmSentObject = function()
{
    if (ResponseMTPOK())
    {
        console.log("Success.");
        document.getElementById("process-percentage").innerText = "File sent successfully.";
    }
    else
    {
        let lastCreatedFile = document.getElementById((file_list.length - 1).toString());
        lastCreatedFile.remove();
        file_list.pop();
        file_size_list.pop();
    }
}

const readStorageInfo = function()
{
    if (ResponseMTPOK())
    {
        // Handle MTP_OK response
    }
    else
    {
        storage_info_objects[activeStorageIndex].initDatasetFromMTPContainer(receivedBuffer);
        showStorageInfo(activeStorageIndex);
    }
}

function requestStorageInfo(str_id)
{
    let reqStorageInfo = new mtp_container(1);
    reqStorageInfo.setTransactionID(0x09);
    reqStorageInfo.setTransactionType(CONTAINER_TYPE_COMMAND);
    reqStorageInfo.setOperation(GET_STORAGE_INFO);
    reqStorageInfo.setParams(storage_id[str_id], 0, 0, 0, 0);
    reqStorageInfo.pack();
    receivedBuffer = null;
    activeStorageIndex = str_id;
    currentCallback = readStorageInfo;
    sendContainer(reqStorageInfo);
}

function readObjectHandles()
{
    let text_box = document.getElementById("logger");

    if (ResponseMTPOK())
    {
        get_object_id_mtp_ok = true;
    }
    else
    {
        let length = receivedBuffer[12] | (receivedBuffer[13] << 8) | (receivedBuffer[14] << 16) | (receivedBuffer [15] << 24);
        file_object_id = new Array(length);
        let readBase = 16;
        for (let i = 0; i < length; i++)
        {
            file_object_id[i] = receivedBuffer[readBase + (i * 4)] | receivedBuffer[(readBase + 1) + (i * 4)] << 8 | receivedBuffer[(readBase + 2) + (i * 4)] << 16 | receivedBuffer[(readBase + 3) + (i * 4)] << 24;
        }
        get_object_id_done = true;
    }

    if (get_object_id_mtp_ok && get_object_id_done === true)
    {
        requestObjectInfo(0);
        get_object_id_done = false;
        get_object_id_mtp_ok = false;
    }
}

const readObjectInfo = function()
{
    let text_box = document.getElementById("logger");
    // text_box.innerHTML = text_box.innerHTML + "\n" + "Received Data: " + receivedBuffer;

    if (ResponseMTPOK())
    {
        get_object_info_mtp_ok = true;
    }
    else
    {
        let fileNameLength = (receivedBuffer[FILE_NAME_START - 1] * 2);
        let i = 0;

        let sliced_name_array = receivedBuffer.slice(FILE_NAME_START, FILE_NAME_START + fileNameLength);
        file_object_info = new Uint8Array(sliced_name_array.length/2 - 1);
        for (let j = 0; j < sliced_name_array.length; j+=2)
        {
            file_object_info[i] = sliced_name_array[j];
            i++;
        }
        file_list.push(bin2String(file_object_info))
        get_object_info_done = true;

        let fileSize = receivedBuffer[20] | receivedBuffer[21] << 8 | receivedBuffer[22] << 16 | receivedBuffer[23] << 24;
        file_size_list.push(fileSize);
    }
    if (get_object_info_done && get_object_info_mtp_ok === true)
    {
        /* Next */
        get_object_info_mtp_ok = false;
        get_object_info_done = false;

        objectInfoActiveIndex ++;
        if (objectInfoActiveIndex === file_object_id.length)
        {
            gotFileInfo = true;
            showFilesToUser();
        }
        else
        {
            requestObjectInfo(objectInfoActiveIndex);
        }
    }
}


function showFilesToUser()
{
    console.log(file_list);
    file_list.forEach((file, index) => {
        createFileElement(file, index);
    });

    /* Show Storage Info */
    requestStorageInfo(activeStorageIndex);
}

function createFileElement(file, index)
{
    let file_element = document.createElement("div");
    let filesize_element = document.createElement("div");
    let context_element = document.createElement("div");

    context_element.innerHTML = '<div class="context-menu"> <div class="item"> <i class="fa fa-download"></i> Download </div> <div class="item"> <i class="fa fa-folder-open"></i> Open as text.. </div> <div class="item"> <i class="fa fa-trash-o"></i> Delete </div> </div>';
    context_element.id = 'context-menu-' + index.toString();
    document.getElementById("manager").appendChild(file_element);
    document.getElementById("manager").appendChild(context_element);
    file_element.innerHTML = file;
    file_element.id = index.toString();
    file_element.appendChild(filesize_element);
    var download = context_element.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[0];
    var openAsTextOption = context_element.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[1];
    var deleteOption = context_element.getElementsByClassName("context-menu")[0].getElementsByClassName("item")[2];
    file_element.className = "file"
    setFileInfo(index);
    download.addEventListener("click", function(e){openFile()});
    openAsTextOption.addEventListener("click", function(e){openAsText()});
    deleteOption.addEventListener("click", function(e){deleteFile()});

    file_element.addEventListener("click", function(e)
    {
        let current_element = document.getElementById(this.id);
        document.getElementById(activeFileIndex.toString()).classList.remove("active");
        current_element.classList.add("active");
        document.getElementById("context-menu-" + activeFileIndex.toString()).getElementsByClassName("context-menu")[0].classList.remove("active");
        activeFileIndex = parseInt(this.id);
        //setFileInfo(this.id);
    });
    file_element.addEventListener("contextmenu",function(event)
    {
        event.preventDefault();
        var contextMenu = document.getElementById("context-menu-" + index.toString());
        var contextElement = contextMenu.getElementsByClassName("context-menu")[0];
        document.getElementById("context-menu-" + activeFileIndex.toString()).getElementsByClassName("context-menu")[0].classList.remove("active");

        let current_element = document.getElementById(this.id);
        document.getElementById(activeFileIndex.toString()).classList.remove("active");
        current_element.classList.add("active");
        activeFileIndex = parseInt(this.id);

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
        //setFileInfo(this.id);
        contextElement.classList.add("active");
    });
}


function showStorageInfo(storageIndex)
{

    let storage_info_div = document.getElementById("storage-info");

    let freeSpace = storage_info_objects[storageIndex].freeSpace;
    let storageSize = storage_info_objects[storageIndex].storageSize;

    if (storageSize > 1073741824)
    {
        storage_info_div.innerText = (freeSpace / (1024 * 1024 * 1024)).toString() + " GB free" + " / " + (storageSize / (1024 * 1024 * 1024)).toString() + " GB";
    } else
    {
        storage_info_div.innerText = (freeSpace / (1024 * 1024)).toString() + " MB free" + " / " + (storageSize / (1024 * 1024)).toString() + " MB";
    }
}

function setFileInfo(index)
{
    let file_size_element = null;
    if (document.getElementById(index.toString()).getElementsByClassName("fileSize")[0] === undefined)
    {
        file_size_element = document.createElement("div");
        file_size_element.className = "fileSize";
        document.getElementById(index.toString()).appendChild(file_size_element);
    }
    else
    {
        file_size_element = document.getElementById(index.toString()).getElementsByClassName("fileSize")[0];
    }
    /* activeFileIndex = index; */

    /* Size */
    if (file_size_list[index] < 1024)
    {
        file_size_element.innerText = file_size_list[index] + " bytes";
    }
    else if (file_size_list[index] < 1048576)
    {
        file_size_element.innerText = (file_size_list[index]/1024).toFixed(2) + " KB";
    }
    else
    {
        file_size_element.innerText = (file_size_list[index]/1048576).toFixed(2) + " MB";
    }
}

function openFile()
{
    CONTEXT_MENU_OPTION = DOWNLOAD;
    requestObject(activeFileIndex);

    /* Setup popup for download */
    document.getElementById("process").innerText = "Fetching file..";
    document.getElementById("process-filename").innerText = file_list[activeFileIndex];
    document.getElementById("progress-bar").value = 0;
    document.getElementById("process-percentage").innerText = "0%";
    document.getElementById("myPopup").style.display = "block";
}

function openAsText()
{
    CONTEXT_MENU_OPTION = OPEN_AS_TEXT;

    /* Setup popup to fetch file */
    document.getElementById("process").innerText = "Fetching as text..";
    document.getElementById("process-filename").innerText = file_list[activeFileIndex];
    document.getElementById("progress-bar").value = 0;
    document.getElementById("process-percentage").innerText = "0%";
    document.getElementById("myPopup").style.display = "block";

    requestObject(activeFileIndex);
    console.log("Requested Object");
    document.getElementById("text-editor").classList.add("sidePanelOpen");
    document.getElementsByClassName("file-manager")[0].classList.add("sidePanelOpen");

    let file_size_right = document.getElementById("file-size");
    let file_name_right = document.getElementById("file-name");

    /* Set File Name and size on right panel */
    file_name_right.innerText = file_list[activeFileIndex];
    if (file_size_list[activeFileIndex] < 1024)
    {
        file_size_right.innerText = file_size_list[activeFileIndex] + " bytes";
    }
    else if (file_size_list[activeFileIndex] < 1048576)
    {
        file_size_right.innerText = (file_size_list[activeFileIndex]/1024).toFixed(2) + " KB";
    }
    else
    {
        file_size_right.innerText = (file_size_list[activeFileIndex]/1048576).toFixed(2) + " MB";
    }
}

function deleteFile()
{
    CONTEXT_MENU_OPTION = DELETE;
    let delete_packet = new mtp_container(1);
    delete_packet.setTransactionID(0x07);
    delete_packet.setOperation(DELETE_OBJECT);
    delete_packet.setTransactionType(CONTAINER_TYPE_COMMAND);
    delete_packet.setParams(file_object_id[activeFileIndex], 0, 0, 0, 0);
    delete_packet.pack();
    currentCallback = readDeletionOK;
    sendContainer(delete_packet);
}

function requestObject()
{
    let reqObj = new mtp_container(1);
    reqObj.setTransactionID(0x04);
    reqObj.setTransactionType(CONTAINER_TYPE_COMMAND);
    reqObj.setOperation(GET_OBJECT);
    reqObj.setParams(file_object_id[activeFileIndex], 0, 0, 0, 0);
    reqObj.pack()
    currentCallback = readObj;
    my_device.transferOut(ENDPOINT_OUT, reqObj.container_array);
}

const readObj = async function()
{
    if (ResponseMTPOK())
    {
        get_object_mtp_ok = true;
    }
    else
    {
        if (file_length === null)
        {
            file_length = ((receivedBuffer[0] | (receivedBuffer[1] << 8) | (receivedBuffer[2] << 16) | (receivedBuffer [3] << 24)) - 12) * 2;
            file_buffer.push.apply(file_buffer, receivedBuffer.slice(12, receivedBuffer.length));
        }
        else
        {
            file_buffer.push.apply(file_buffer, receivedBuffer);

            /* Update progress */
            updateProgressBar(((file_buffer.length * 2)/file_length) * 100);
        }
    }
    if (file_buffer.length * 2 === file_length)
    {
        switch(CONTEXT_MENU_OPTION)
        {
            case DOWNLOAD:
                let file_ = Uint8Array.from(file_buffer);
                file_blob = new Blob([file_]);
                await downloadAsFile(file_blob);
                file_buffer = new Array(0);
                break;
            case OPEN_AS_TEXT:
                let file = bin2String(file_buffer);
                document.getElementById("text-area").value = file;
                document.getElementById("myPopup").style.display = "none";
                file_length = null;
                file_buffer = new Array(0);
                get_object_done = false;
                get_object_mtp_ok = false;
                break;
            default:
                console.log("Invalid operation on file.");
                console.log(CONTEXT_MENU_OPTION);
                break;
        }
        console.log(this);
    }
}

async function downloadAsFile(blob)
{
    let url = window.URL.createObjectURL(blob);

    const file_element = document.createElement("a");
    document.getElementById(activeFileIndex).appendChild(file_element);
    file_element.href = url;
    let filename = file_element.parentElement.innerText;
    file_element.download = filename.split("\n")[0];
    file_element.click();

    file_length = null;
    file_buffer = new Array(0);
    get_object_done = false;
    get_object_done = false;
    get_object_mtp_ok = false;
}


function bin2String(array)
{
    let result = "";
    for (let i = 0; i < array.length; i+=1)
    {
        result += String.fromCharCode(array[i]);
    }
    return result;
}

function requestObjectInfo(file_handle_number)
{
    /* Get ObjectInfo of all received handles */
    let getObjInfo = new mtp_container(1);
    getObjInfo.setTransactionType(CONTAINER_TYPE_COMMAND);
    getObjInfo.setOperation(GET_OBJECT_INFO);
    getObjInfo.setTransactionID(0x03);
    getObjInfo.setParams(file_object_id[objectInfoActiveIndex], 0, 0, 0 , 0);
    getObjInfo.pack();
    currentCallback = readObjectInfo;
    my_device.transferOut(ENDPOINT_OUT, getObjInfo.container_array);

}

function requestStorageIDS()
{
        /* Get Storage IDS */
        let getStorageIDS = new mtp_container(0);
        getStorageIDS.setTransactionType(CONTAINER_TYPE_COMMAND);
        getStorageIDS.setOperation(GET_STORAGE_IDS);
        getStorageIDS.setTransactionID(0x02);
        getStorageIDS.pack();
        currentCallback = readStorageIDS;
        my_device.transferOut(ENDPOINT_OUT, getStorageIDS.container_array);
}

function readDeletionOK()
{
    if (ResponseMTPOK())
    {
        document.getElementById(activeFileIndex.toString()).remove();
        requestStorageInfo(activeStorageIndex);
        activeFileIndex = 0;
    }
}


function connect()
{
    {
        navigator.usb.requestDevice({ filters: [{}] })
            .then(device => {
                my_device = device;
                console.log(device.productName);      // "Arduino Micro"
                console.log(device.manufacturerName); // "Arduino LLC"
                connectionStatus = 1;
                my_device.open().then(() => {
                    return my_device.selectConfiguration(1);
                })
                    .then(() => {
                        return my_device.claimInterface(0);
                    })
                    .then(() => {
                        readLoop();
                    })
                    .then( () => {
                        /* Open session */
                        let openSession = new mtp_container(5);
                        openSession.setTransactionType(CONTAINER_TYPE_COMMAND);
                        openSession.setOperation(OPEN_SESSION);
                        openSession.setTransactionID(0x01);
                        openSession.setParams(0, 1, 0, 0 , 0);
                        openSession.pack();
                        currentCallback = checkIfOK;
                        my_device.transferOut(ENDPOINT_OUT, openSession.container_array);
                        console.log(openSession.container_array);
                    })
                    .catch(error => { console.log(error); });
            });
    }
}

