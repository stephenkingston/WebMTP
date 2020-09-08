/* This library file contains high-level functions derived from mtp_classes.mtp */
let device = null;

/* MTPDeviceInit() initializes the device and get a snapshot of all storage's and file objects in them */
async function MTPDeviceInit()
{
    device = new MTPDevice();
    let status = null;
    try
    {
        let success = await device.getEndpoints();
        let connected = false;
        if (success)
        {
            connected = await device.connectDevice(device);
        }
        if (connected)
        {
            status = await device.openSession(device);
        }

        if (status === true)
        {
            console.log("MTP device initialized successfully.");
            return device;
        }
    }
    catch(err)
    {
        console.log("Error in USB connection. Error:" + err);
        return null;
    }
}

async function downloadFile(MTPDevice, storageID, fileID, progressBar)
{
    let storageObject = MTPDevice.storageInfoObjects.find(storageObject => storageObject.storageID === storageID);
    let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
    let fileObject = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.find(fileObject => fileObject.fileID === fileID);

    try
    {
        let [status, fileBlob] = await MTPDevice.downloadFile(MTPDevice, storageObject, fileObject, progressBar);

        if (status === true)
        {
            console.log("File downloaded successfully.");
            return fileBlob;
        }
    }
    catch(err)
    {
        console.log("Error downloading file. " + err);
        return null;
    }
}

async function disconnect(MTPDevice)
{
    try
    {
        let status = await MTPDevice.closeSession(MTPDevice);
        await MTPDevice.device.close();

        if (status === true)
        {
            console.log("Device session closed successfully.");
        }
    }
    catch(err)
    {
        console.log("Error disconnecting." + err);
    }
}

async function getStorageIDS(MTPDevice)
{
    try
    {
        let status1 = await MTPDevice.getStorageIDS(MTPDevice);
        let status2 = null;
        for (const storageObject of MTPDevice.storageInfoObjects)
        {
            status2 = await MTPDevice.getStorageInfo(MTPDevice, storageObject);
        }

        if (status1 === true && status2 === true)
        {
            console.log("Fetched storage IDS. Found " + MTPDevice.storageInfoObjects.length + ".");
            return MTPDevice.storageInfoObjects;
        }
    }
    catch(err)
    {
        console.log("Error getting storage IDS. Error:" + err);
        return null;
    }
}

async function getFileObjects(MTPDevice, storageID)
{
    try
    {
        let storageObject = MTPDevice.storageInfoObjects.find((storageObject) => {return storageObject.storageID === storageID});
        let storageObjectIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let status1 = await MTPDevice.getFileObjects(MTPDevice, storageObject);
        let status2 = null;

        for (const fileObject of MTPDevice.storageInfoObjects[storageObjectIndex].objectInfoObjects)
        {
            status2 = await MTPDevice.getFileObjectInfo(MTPDevice, storageObject, fileObject);
        }

        if (status1 === true && status2 === true)
        {
            console.log("Fetched file objects. Found " + MTPDevice.storageInfoObjects[storageObjectIndex].objectInfoObjects.length + ".");
            return MTPDevice.storageInfoObjects[storageObjectIndex].objectInfoObjects;
        }
    }
    catch(err)
    {
        console.log("Error getting file objects. Error:" + err);
        return null;
    }
}

async function deleteObject(MTPDevice, storageID, fileID)
{
    try
    {
        let storageObject = MTPDevice.storageInfoObjects.find(storageObject => storageObject.storageID === storageID);
        let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let fileObject = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.find(fileObject => fileObject.fileID === fileID);
        console.log(MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects);
        let status = await MTPDevice.deleteFile(MTPDevice, storageObject, fileObject);

        if(status === true)
        {
            console.log("Successfully deleted the selected object");
        }
    }
    catch(err)
    {
        console.log("Unable to delete the selected file. " + err);
        return null;
    }
}

async function uploadFile(MTPDevice, storageID, file, bytes, progressBar)
{
    try
    {
        let storageObject = MTPDevice.storageInfoObjects.find(storageObject => storageObject.storageID === storageID);
        console.log(storageObject);
        let [status1, newObjectID] = await MTPDevice.uploadFileInfo(MTPDevice, storageObject, file.name, bytes.length);

        let status2 = await MTPDevice.uploadFile(MTPDevice, storageObject, newObjectID, bytes, progressBar);
        console.log(status1, status2, newObjectID);

        if(status1 === true && status2 === true)
        {
            console.log("Successfully uploaded the file.");
        }
    }
    catch(err)
    {
        console.log("Error uploading file. " + err);
        return null;
    }
}