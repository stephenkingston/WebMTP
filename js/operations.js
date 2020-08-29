/* This file contains high-level functions derived from classes.js */
let device = null;

/* MTPDeviceInit() initializes the device and get a snapshot of all storage's and file objects in them */
async function MTPDeviceInit()
{
    device = new Device();
    try
    {
        await device.connectDevice(device);
        let status = await device.openSession(device);
        if (status === true)
        {
            console.log("MTP device initialized successfully.");

            let storageObjects = await getStorageIDS(device);
            console.log(storageObjects);

            let fileObjects = null;
            for (const storage of storageObjects)
            {
                fileObjects = await getFileObjects(device, storage)
            }
            console.log(fileObjects);
            return device;
        }
    }
    catch(err)
    {
        console.log("Error in USB connection. Error:" + err);
        return null;
    }
}


async function downloadFile(MTPDevice, storageID, fileID)
{
    let storageObject = MTPDevice.storageInfoObjects.find(storageObject => storageObject.storageID === storageID);
    let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
    let fileObject = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.find(fileObject => fileObject.fileID === fileID);

    try
    {
        let [status, fileBlob] = await MTPDevice.downloadFile(MTPDevice, storageObject, fileObject);

        if (status === true)
        {
            console.log("File downloaded successfully.");
            return fileBlob;
        }
    }
    catch(err)
    {
        console.log("Error downloading file. " + err);
    }
}

async function disconnect(MTPDevice)
{
    try
    {
        let status = await MTPDevice.closeSession(MTPDevice);

        if (status === true)
        {
            console.log("MTP device session closed successfully.");
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
        let status = await MTPDevice.getStorageIDS(MTPDevice);
        if (status === true)
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

async function getFileObjects(MTPDevice, storageObject)
{
    try
    {
        let storageIDIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let status1 = await MTPDevice.getFileObjects(MTPDevice, storageObject);
        let status2 = null;

        for (const fileObject of MTPDevice.storageInfoObjects[storageIDIndex].objectInfoObjects)
        {
            status2 = await MTPDevice.getFileObjectInfo(MTPDevice, storageObject, fileObject);
        }

        if (status1 === true && status2 === true)
        {
            console.log("Fetched file objects. Found " + MTPDevice.storageInfoObjects[storageIDIndex].objectInfoObjects.length + ".");
            return MTPDevice.storageInfoObjects[storageIDIndex].objectInfoObjects;
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