/* Container Type */
const CONTAINER_TYPE_UNDEFINED = 0x0000;
const MTP_CONTAINER_TYPE_COMMAND = 0x0001;
const CONTAINER_TYPE_DATA = 0x0002;
const CONTAINER_TYPE_RESPONSE = 0x0003;
const CONTAINER_TYPE_EVENT = 0x0004;

/* Operation Codes */
const MTP_OPEN_SESSION = 0x1002;
const MTP_GET_STORAGE_IDS = 0x1004;
const MTP_GET_STORAGE_INFO = 0x1005;
const GET_OBJECT_HANDLES = 0x1007;
const GET_OBJECT_INFO = 0x1008;
const GET_OBJECT = 0x1009;
const CLOSE_SESSION = 0x1003;
const MTP_DELETE_OBJECT = 0x100B;
const SEND_OBJECT_INFO = 0x100C;
const SEND_OBJECT = 0x100D;

/* Object formats */
const OBJECT_FORMAT_TEXT = 0x3004;
const GET_ROOT_OBJECTS = 0xFFFFFFFF;
const UNDEFINED_OBJECT_FORMAT = 0x3000;
const PLACE_IN_ROOT = 0xFFFFFFFF;

/* Response codes */
const MTP_OK = 0x2001;
const SESSION_ALREADY_OPEN = 0x201E;

/* Others */
const FILE_NAME_START = 65;

/* General Class definition for an MTP container */
class mtp_container
{
    /* Parameter length in bytes */
    constructor(parameterLength)
    {
        /* Length of parameters in bytes at the end of MTP container */
        this.parameterArrayLength = parameterLength * 4; // Length in bytes
        this.containerArrayLength = this.parameterArrayLength + 12;

        /* Array definitions */
        this.container_array = new Uint8Array(this.containerArrayLength);
        this.parameters_array = new Uint8Array(this.parameterArrayLength);

        /* Container elements' definitions */
        this.type = 0;
        this.operation = 0;
        this.transaction_id = 0;
        this.parameters = new Uint32Array(this.parameters_array);
    }

    /* Set transaction type */
    setTransactionType(transactionType)
    {
        this.type = transactionType;
    }

    /* Set operation type */
    setOperation(operation)
    {
        this.operation = operation;
    }

    /* Set transaction ID */
    setTransactionID(transaction_id)
    {
        this.transaction_id = transaction_id;
    }

    setParams(param1, param2, param3, param4, param5)
    {
        for (let i = 0; i < 4; i++)
        {
            this.parameters_array[i] = (param1 >> (i * 8)) & 0xFF;
        }
        for(let i = 0; i < 4; i++)
        {
            this.parameters_array[i+4] = (param2 >> (i * 8)) & 0xFF;
        }
        for(let i = 0; i < 4; i++)
        {
            this.parameters_array[i+8] = (param3 >> (i * 8)) & 0xFF;
        }
        for(let i = 0; i < 4; i++)
        {
            this.parameters_array[i+12] = (param4 >> (i * 8)) & 0xFF;
        }
        for(let i = 0; i < 4; i++)
        {
            this.parameters_array[i+16] = (param5 >> (i * 8)) & 0xFF;
        }
    }

    pack() {
        /* Packing container length */
        for (let i = 0; i < 4; i++)
        {
            this.container_array[i] = (this.containerArrayLength >> (i * 8)) & 0xFF;
        }

        /* Packing Container Type */
        this.container_array[4] = this.type & 0xFF;
        this.container_array[5] = (this.type >> 8) & 0xFF;

        /* Packing Operation code */
        this.container_array[6] = this.operation & 0xFF;
        this.container_array[7] = (this.operation >> 8) & 0xFF;

        /* Packing transaction id */
        for (let i = 8; i < (this.containerArrayLength - this.parameterArrayLength); i++) {
            this.container_array[i] = (this.transaction_id >> ((i - 8) * 8)) & 0xFF;
        }

        /* Packing parameters */
        for (let i = (this.containerArrayLength - this.parameterArrayLength); i < this.containerArrayLength; i++) {
            this.container_array[i] = this.parameters_array[i - (this.containerArrayLength - this.parameterArrayLength)];
        }
    }
}


/* Storage Info Dataset Definition */

class storageInfoDataset
{
    constructor(str_id)
    {
        this.storageID = str_id;
        this.storageSize = 0;
        this.usedSpace = 0;
        this.freeSpace = 0;
        this.storageDescLength = 0;
        this.storageDescription = "";
        this.objectInfoObjects = new Array(0);
    }
    initDatasetFromMTPContainer(receivedBuf)
    {
        /* Storage Size */
        let storageSize = 0;
        for (let i = 18; i < 26; i++)
        {
            storageSize |= (receivedBuf[i] << ((i - 10) * 8));
        }
        this.storageSize = storageSize;

        /* Free Space */
        let freeSpace = 0;
        for (let i = 26; i < 34; i++)
        {
            freeSpace |= (receivedBuf[i] << ((i - 18) * 8));
        }
        this.freeSpace = freeSpace;

        /* Used Space */
        this.usedSpace = storageSize - freeSpace;

        this.baseAddr = 38;
        this.storageDescLength = receivedBuf[this.baseAddr] | receivedBuf[this.baseAddr + 1] << 8
            | receivedBuf[this.baseAddr + 2] << 16 | receivedBuf[this.baseAddr + 3] << 24;
    }
}


/* Object Info Dataset Definition */

class ObjectInfoDataset
{
    constructor(file_id)
    {
        this.containerLength = 52;
        this.container_array = new Uint8Array(this.containerLength);
        this.container_array.fill(0);
        this.filename_array = new Uint8Array(0);
        this.concatArray = null;
        this.fileID = file_id;
        this.fileName = "";
        this.dateModArray = new Uint8Array(6);
        this.dateModArray = [0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0];
    }

    setFileName(filenameArray)
    {
        this.fileName = bin2String(filenameArray)
    }

    initContainer(objectFormat, objectCompressedSize, associationType, associationDesc, filename)
    {
        /* File Name */
        this.filename_array = new Uint8Array(filename.length * 2);
        this.fileName = filename;
        let j = 0;
        for (let i = 0; j < filename.length; i+= 2)
        {
            if (i === 0)
            {
                this.filename_array[i] = filename.length;
            }
            else
            {
                this.filename_array[i] = 0;
            }
            this.filename_array[i+1] = (filename.charCodeAt(j));
            j++;
        }
        console.log(this.filename_array);

        /* Object Format */
        for (let i = 4; i < 6; i++)
        {
            this.container_array[i] = ((objectFormat >> ((i-8) * 8)) & 0xFF);
        }

        /* Object Size (bytes) */
        for (let i = 8; i < 12; i++)
        {
            this.container_array[i] = ((objectCompressedSize >> ((i-12) * 8)) & 0xFF);
        }

        /* Association Type */
        for (let i = 42; i < 44; i++)
        {
            this.container_array[i] = ((associationType >> ((i-42) * 8)) & 0xFF);
        }

        /* Association Description */
        for (let i = 44; i < 48; i++)
        {
            this.container_array[i] = ((associationDesc >> ((i-44) * 8)) & 0xFF);
        }
    }
}

/* Configuration Descriptor class */

class deviceDescriptor
{
    constructor(devDescriptorArray, configDescriptorArray)
    {
        this.bLength = devDescriptorArray[0];
        this.bNumConfigurations = devDescriptorArray[17];
        this.configDescriptors = new Array(0);
        this.configDescriptorLength = 0;

        this.lastSliceLength = 0;
        console.log("Yes", this.bNumConfigurations)

        /* Split configuration Descriptor Arrays */
        for (let i = 0; i < this.bNumConfigurations; i++)
        {
            this.configDescriptorLength = configDescriptor[2 + this.configDescriptorLength];
            let configDescriptor = configDescriptorArray.slice(this.lastSliceLength, this.configDescriptorLength + this.lastSliceLength)
            this.lastSliceLength = this.configDescriptorLength;
            console.log(configDescriptor);
            this.configDescriptors.push(new configDescriptor(configDescriptor));
        }
    }
}

class configDescriptor
{
    constructor(configDescriptorArray)
    {
        this.bLength = configDescriptorArray[0];
        this.wTotalLength = configDescriptorArray[2] | configDescriptorArray[3] << 8;
        this.bNumInterfaces = configDescriptorArray[4];

        this.interfaceDescriptors = new Array(0);


        for (let i = 0; i < this.bNumInterfaces; i++)
        {

        }
    }
}

class interfaceDescriptor
{
    constructor()
    {

    }
}

class endpointDescriptor
{
    constructor(endpointDescriptorArray)
    {
        this.bLength = endpointDescriptorArray[0];
        this.bmAttributes = endpointDescriptorArray[3];
        this.endPointAddr = endpointDescriptorArray[2];
        this.endpointDescriptors = new Array(0);

        this.endpointDescriptors.push(new endpointDescriptor(endpointDescriptorArray))
    }
}

/* Device class for all device operations */

class MTPDevice
{
    constructor()
    {
        this.endpointIn = 0;
        this.endpointOut = 0;
        this.device = null;
        this.sessionOpen = false;
        this.storageInfoObjects = new Array(0);
        this.objectInfoObjects = new Array(0);
        this.transactionID = 0x01;
        this.interfaceNumber = 0;
    }

    async getEndpoints()
    {
        // let deviceDescriptorArray = null;
        // let configDescriptorArray = null;
        //
        // /* Requesting Device Descriptor */
        // await this.device.controlTransferIn({ requestType: 'standard',
        //                                 recipient: 'device',
        //                                 request: 0x06,
        //                                 value: 0x0100,
        //                                 index: 0x00},30)
        // .then((input) =>
        // {
        //     deviceDescriptorArray = new Uint8Array(input.data.buffer);
        //     console.log(deviceDescriptorArray);
        // })
        //
        // /* Requesting Configuration Descriptor */
        // await this.device.controlTransferIn({ requestType: 'standard',
        //     recipient: 'device',
        //     request: 0x06,
        //     value: 0x200,
        //     index: 0x00},128)
        //     .then((input2) => {
        //         configDescriptor = new Uint8Array(input2.data.buffer);
        //         console.log(configDescriptor);
        //     });
        //
        // let descriptorObject = new deviceDescriptor(deviceDescriptor, configDescriptor);


        var configurationInterfaces = this.device.configuration.interfaces;
        let element = configurationInterfaces[0];

        element.alternates.forEach(elementalt => {
            this.interfaceNumber = element.interfaceNumber;
                elementalt.endpoints.forEach(elementendpoint => {
                    if (elementendpoint.direction === "out" && elementendpoint.type === "bulk") {
                        this.endpointOut = elementendpoint.endpointNumber;
                        console.log(this.endpointOut);
                    }
                    if (elementendpoint.direction==="in" && elementendpoint.type === "bulk") {
                        this.endpointIn =elementendpoint.endpointNumber;
                        console.log(this.endpointIn);
                    }
                })
            })
    }


    async receivePackets(MTPDevice, no_of_packets)
    {
        let receivedBuffer = new Array(0);
        let i = 0;

        return new Promise((resolve) => {
            while(true)
            {
                if (i === no_of_packets)
                {
                    Promise.all(receivedBuffer).then(()=>{
                        let rawData = new Array(0);
                        for (let i = 0; i < no_of_packets; i++)
                        {
                            receivedBuffer[i].then((result) => {
                                rawData.push(result);
                            });
                        }
                        resolve(rawData);
                    })
                    break;
                }
                else
                {
                    i++;
                    receivedBuffer.push(this.getPacket(MTPDevice));
                }
            }
        });
    }

    getPacket(MTPDevice)
    {
        return new Promise((resolve) => {
            MTPDevice.device.transferIn(MTPDevice.endpointIn, 512)
            .then((result) =>
            {
                resolve(new Uint8Array(result.data.buffer));
            });
        });
    }

    async connectDevice(MTPDevice)
    {
        // try
        {
            this.device = await navigator.usb.requestDevice({ filters: [{}]});
            if (this.device !== undefined)
            {
                await this.device.open();
                await this.device.selectConfiguration(1);
                await this.device.claimInterface(0);
                await this.getEndpoints();
                return true;
            }
        }
        // catch
        // {
        //     console.log("Error connecting to target.");
        //     return false;
        // }
    }

    async openSession(MTPDevice)
    {
        let promise = new Promise(function(resolve)
        {
            MTPDevice.device.transferIn(MTPDevice.endpointIn, 512)
                .then((result) => {
                    let receivedBuffer = new Uint8Array(result.data.buffer);

                    /* Handling successful session open */
                    if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === MTP_OK)
                    {
                        MTPDevice.sessionOpen = true;
                        resolve(true);
                    }

                    /* Session already open */
                    else if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === SESSION_ALREADY_OPEN)
                    {
                        MTPDevice.sessionOpen = true;
                        resolve(true);
                    }
                    else
                    {
                        MTPDevice.sessionOpen = false;
                        throw("Unhandled exception when opening session.");
                    }
                })
                .catch((err) => {
                    console.log("Error opening session. " + err)
                    resolve(false);
                })
        })

        /* Open session */
        let openSession = new mtp_container(5);
        openSession.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        openSession.setOperation(MTP_OPEN_SESSION);
        openSession.setTransactionID(MTPDevice.transactionID++);
        openSession.setParams(0, 1, 0, 0 , 0);
        openSession.pack();
        MTPDevice.device.transferOut(MTPDevice.endpointOut, openSession.container_array);

        return promise;
    }

    async closeSession(MTPDevice)
    {
        let disconnectPromise = new Promise(function(resolve)
        {
            MTPDevice.device.transferIn(MTPDevice.endpointIn, 512)
                .then((result) => {
                    let receivedBuffer = new Uint8Array(result.data.buffer);

                    /* Handling successful deletion */
                    if ((receivedBuffer[7] << 8 | receivedBuffer[6]) === MTP_OK)
                    {
                        MTPDevice.sessionOpen = false;
                        resolve(true);
                    }
                    else
                    {
                        throw("Unhandled exception when closing session.");
                    }
                })
                .catch((err) => {
                    console.log("Error closing session. " + err)
                    resolve(false);
                })
        })

        /* Close session */
        let closeSessionRequest = new mtp_container(0);
        closeSessionRequest.setOperation(CLOSE_SESSION);
        closeSessionRequest.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        closeSessionRequest.setTransactionID(MTPDevice.transactionID++);
        closeSessionRequest.pack()
        MTPDevice.device.transferOut(MTPDevice.endpointOut, closeSessionRequest.container_array);

        return disconnectPromise;
    }

    getStorageIDS(MTPDevice)
    {
        let results = this.receivePackets(MTPDevice, 2);

        let storageIDSPromise = new Promise(function(resolve)
        {
            let storageIDBuffer = null;
            let MTP_OKBuffer = null;

            results.then((receivedPackets) => {
                if ((receivedPackets[0][7] << 8 | receivedPackets[0][6]) === MTP_GET_STORAGE_IDS)
                {
                    storageIDBuffer = receivedPackets[0];
                    MTP_OKBuffer = receivedPackets[1];
                }
                else
                {
                    storageIDBuffer = receivedPackets[1];
                    MTP_OKBuffer = receivedPackets[0];
                }

                if ((MTP_OKBuffer[7] << 8 | MTP_OKBuffer[6]) === MTP_OK)
                {
                    /* Handling MTP_OK & receiving storage IDS */

                    MTPDevice.storageInfoObjects = new Array(0);
                    let numberOfStorageIDS = storageIDBuffer[12] | (storageIDBuffer[13] << 8) | (storageIDBuffer[14] << 16) | (storageIDBuffer [15] << 24);
                    let readBase = 16;
                    for (let i = 0; i < numberOfStorageIDS; i++)
                    {
                        let storage_id = storageIDBuffer[readBase + (i * 4)] | storageIDBuffer[(readBase + 1) + (i * 4)] << 8 | storageIDBuffer[(readBase + 2) + (i * 4)] << 16 | storageIDBuffer[(readBase + 3) + (i * 4)] << 24;
                        MTPDevice.storageInfoObjects.push(new storageInfoDataset(storage_id));
                    }
                    resolve(true);
                }
                else
                {
                    throw("Unhandled exception when fetching storage IDs.");
                }
            })
            .catch((err) => {
                    console.log("Error getting storage IDs. " + err)
                    resolve(false);
            });
        })

        /* Get Storage IDS */
        let getStorageIDS = new mtp_container(0);
        getStorageIDS.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        getStorageIDS.setOperation(MTP_GET_STORAGE_IDS);
        getStorageIDS.setTransactionID(MTPDevice.transactionID++);
        getStorageIDS.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, getStorageIDS.container_array);

        return storageIDSPromise;
    }

    getStorageInfo(MTPDevice, storageObject)
    {
        let results = this.receivePackets(MTPDevice, 2);

        let storageInfoPromise = new Promise(function(resolve)
        {
            let storageInfoBuffer = null;
            let MTP_OKBuffer = null;
            results.then((receivedPackets) => {
                if ((receivedPackets[0][7] << 8 | receivedPackets[0][6]) === MTP_GET_STORAGE_INFO)
                {
                    storageInfoBuffer = receivedPackets[0];
                    MTP_OKBuffer = receivedPackets[1];
                }
                else
                {
                    storageInfoBuffer = receivedPackets[1];
                    MTP_OKBuffer = receivedPackets[0];
                }

                if ((MTP_OKBuffer[7] << 8 | MTP_OKBuffer[6]) === MTP_OK)
                {
                    /* Handling MTP_OK & receiving storage Info */
                    storageObject.initDatasetFromMTPContainer(storageInfoBuffer);
                    console.log(storageObject);
                    resolve(true);
                }
                else
                {
                    throw("Unhandled exception when fetching storage info.");
                }
            })
                .catch((err) => {
                    console.log("Error getting storage IDs. " + err)
                    resolve(false);
                });
        })

        let reqStorageInfo = new mtp_container(1);
        reqStorageInfo.setTransactionID(MTPDevice.transactionID++);
        reqStorageInfo.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        reqStorageInfo.setOperation(MTP_GET_STORAGE_INFO);
        reqStorageInfo.setParams(storageObject.storageID, 0, 0, 0, 0);
        reqStorageInfo.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, reqStorageInfo.container_array);
        return storageInfoPromise;
    }

    getFileObjects(MTPDevice, storageObject)
    {
        console.log(storageObject.storageID);
        let results = this.receivePackets(MTPDevice, 2);

        let objectIDSPromise = new Promise(function(resolve)
        {
            let objectIDBuffer = null;
            let MTP_OKBuffer = null;

            let storageIDIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);

            results.then((receivedPackets) => {
                if ((receivedPackets[0][7] << 8 | receivedPackets[0][6]) === GET_OBJECT_HANDLES)
                {
                    objectIDBuffer = receivedPackets[0];
                    MTP_OKBuffer = receivedPackets[1];
                }
                else
                {
                    objectIDBuffer = receivedPackets[1];
                    MTP_OKBuffer = receivedPackets[0];
                }

                if ((MTP_OKBuffer[7] << 8 | MTP_OKBuffer[6]) === MTP_OK)
                {
                    /* Handling MTP_OK & receiving storage IDS */
                    MTPDevice.storageInfoObjects[storageIDIndex].objectInfoObjects = new Array(0);
                    let numberOfObjectIDS = objectIDBuffer[12] | (objectIDBuffer[13] << 8) | (objectIDBuffer[14] << 16) | (objectIDBuffer [15] << 24);
                    let readBase = 16;
                    for (let i = 0; i < numberOfObjectIDS; i++)
                    {
                        let object_id = objectIDBuffer[readBase + (i * 4)] | objectIDBuffer[(readBase + 1) + (i * 4)] << 8 | objectIDBuffer[(readBase + 2) + (i * 4)] << 16 | objectIDBuffer[(readBase + 3) + (i * 4)] << 24;
                        MTPDevice.storageInfoObjects[storageIDIndex].objectInfoObjects.push(new ObjectInfoDataset(object_id));
                    }
                    resolve(true);
                }
                else
                {
                    throw("Unhandled exception when fetching storage IDs.");
                }
            })
                .catch((err) => {
                    console.log("Error getting storage IDs. " + err)
                    resolve(false);
                });
        })

        /* Get Storage IDS */
        let reqObjHandles = new mtp_container(3);
        reqObjHandles.setTransactionID(MTPDevice.transactionID++);
        reqObjHandles.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        reqObjHandles.setOperation(GET_OBJECT_HANDLES);
        reqObjHandles.setParams(storageObject, 0, GET_ROOT_OBJECTS,0, 0);
        reqObjHandles.pack();
        MTPDevice.device.transferOut(this.endpointOut, reqObjHandles.container_array);

        return objectIDSPromise;
    }

    getFileObjectInfo(MTPDevice, storageObject, fileObject)
    {
        let results = this.receivePackets(MTPDevice, 2);

        let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let fileObjectIndex = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.indexOf(fileObject);

        let objectInfoPromise = new Promise(function(resolve)
        {
            let objectInfoBuffer = null;
            let MTP_OKBuffer = null;

            results.then((receivedPackets) => {
                if ((receivedPackets[0][7] << 8 | receivedPackets[0][6]) === GET_OBJECT_INFO)
                {
                    objectInfoBuffer = receivedPackets[0];
                    MTP_OKBuffer = receivedPackets[1];
                }
                else
                {
                    objectInfoBuffer = receivedPackets[1];
                    MTP_OKBuffer = receivedPackets[0];
                }

                if ((MTP_OKBuffer[7] << 8 | MTP_OKBuffer[6]) === MTP_OK)
                {
                    let fileNameLength = (objectInfoBuffer[FILE_NAME_START - 1] * 2);
                    let i = 0;

                    let sliced_name_array = objectInfoBuffer.slice(FILE_NAME_START, FILE_NAME_START + fileNameLength);
                    let file_name_array = new Uint8Array(sliced_name_array.length/2 - 1);

                    for (let j = 0; j < sliced_name_array.length; j+=2)
                    {
                        file_name_array[i] = sliced_name_array[j];
                        i++;
                    }

                    MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects[fileObjectIndex].setFileName(file_name_array);
                    MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects[fileObjectIndex].filesize = objectInfoBuffer[20] | objectInfoBuffer[21] << 8 | objectInfoBuffer[22] << 16 | objectInfoBuffer[23] << 24;
                    resolve(true);
                }
                else
                {
                    throw("Unhandled exception when fetching storage IDs.");
                }
            })
                .catch((err) => {
                    console.log("Error getting Object Info. " + err)
                    resolve(false);
                });
        })

        /* Get ObjectInfo of all received handles */
        let getObjInfo = new mtp_container(1);
        getObjInfo.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        getObjInfo.setOperation(GET_OBJECT_INFO);
        getObjInfo.setTransactionID(MTPDevice.transactionID++);
        getObjInfo.setParams(fileObject.fileID, 0, 0, 0 , 0);
        getObjInfo.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, getObjInfo.container_array);

        return objectInfoPromise;
    }

    downloadFile(MTPDevice, storageObject, fileObject, progressBar)
    {
        let results = MTPDevice.receivePackets(MTPDevice, 1);
        let downloadPromise = new Promise(function(resolve)
        {
            let firstObjectBuffer = new Uint8Array(0);
            let fileLength = null;
            let objectBuffer = new Array(0);

            results.then(async (receivedPackets) => {
                firstObjectBuffer = receivedPackets[0];

                if ((firstObjectBuffer[7] << 8 | firstObjectBuffer[6]) === GET_OBJECT)
                {
                    fileLength = ((firstObjectBuffer[0] | (firstObjectBuffer[1] << 8) | (firstObjectBuffer[2] << 16) | (firstObjectBuffer [3] << 24)) - 12);
                    objectBuffer.push.apply(objectBuffer, firstObjectBuffer.slice(12, firstObjectBuffer.length));

                    let numberOfPacketsToBeReceived = Math.ceil((fileLength - objectBuffer.length)/512);
                    let range = Array.from(Array(numberOfPacketsToBeReceived).keys());
                    for (const i of range)
                    {
                        await MTPDevice.device.transferIn(MTPDevice.endpointIn, 512).then((result)=>{
                            let data = new Uint8Array(result.data.buffer);
                            objectBuffer.push.apply(objectBuffer, data);
                            progressBar.value = ((i/numberOfPacketsToBeReceived) * 100).toFixed(1);
                        })
                    }
                    await MTPDevice.device.transferIn(MTPDevice.endpointIn, 512).then((result)=>{
                        resolve([true, objectBuffer]);
                    })
                }
                else
                {
                    throw("Unhandled exception when initiating download.");
                }
            })
                // .catch((err) => {
                //     console.log("Error getting file. " + err)
                //     resolve(false);
                // });
        })

        /* Get ObjectInfo of all received handles */
        let reqObj = new mtp_container(1);
        reqObj.setTransactionID(MTPDevice.transactionID++);
        reqObj.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        reqObj.setOperation(GET_OBJECT);
        reqObj.setParams(fileObject.fileID, 0, 0, 0, 0);
        reqObj.pack()

        MTPDevice.device.transferOut(MTPDevice.endpointOut, reqObj.container_array);

        return downloadPromise;
    }

    deleteFile(MTPDevice, storageObject, fileObject)
    {
        let result = MTPDevice.receivePackets(MTPDevice, 1);

        let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let fileIndex = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.indexOf(fileObject);

        let deletePromise = new Promise(function(resolve)
        {
            result.then((receivedPacket) => {
                resolve(true);
                if ((receivedPacket[0][7] << 8 | receivedPacket[0][6]) === MTP_OK)
                {
                    resolve("true");
                }
                else
                {
                    throw("Deletion unsuccessful!");
                }
            }).catch((err) => {
                console.log(err);
            })
        })

        let delete_packet = new mtp_container(1);
        delete_packet.setTransactionID(MTPDevice.transactionID++);
        delete_packet.setOperation(MTP_DELETE_OBJECT);
        delete_packet.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        delete_packet.setParams(MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects[fileIndex].fileID, 0, 0, 0, 0);
        delete_packet.pack();
        MTPDevice.device.transferOut(MTPDevice.endpointOut, delete_packet.container_array);

        return deletePromise;
    }

    uploadFileInfo(MTPDevice, storageObject, filename, fileSize)
    {
        let result = MTPDevice.receivePackets(MTPDevice, 1);

        let uploadFileInfoPromise = new Promise(function(resolve)
        {
            console.log(result);
            result.then((receivedPacket) => {
                console.log(receivedPacket);
                if ((receivedPacket[0][7] << 8 | receivedPacket[0][6]) === MTP_OK)
                {
                    let newObjectID = 0;
                    for (let i = 20; i < 24; i++)
                    {
                        newObjectID |= (receivedPacket[0][i] >> (i-20) * 8) & 0xFF;
                    }
                    resolve([true, newObjectID]);
                }
                else
                    {
                        throw("File Info upload unsuccessful!");
                    }
                });
            }).catch((err) => {
                console.log(err);
            });
        let sendObjInfo = new mtp_container(2);
        sendObjInfo.setOperation(SEND_OBJECT_INFO);
        sendObjInfo.setTransactionID(MTPDevice.transactionID++);
        sendObjInfo.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        sendObjInfo.setParams(storageObject.storageID, PLACE_IN_ROOT, 0, 0, 0);
        sendObjInfo.pack();
        MTPDevice.device.transferOut(MTPDevice.endpointOut, sendObjInfo.container_array);

        let fileInfo = new ObjectInfoDataset(0x01);
        fileInfo.initContainer(UNDEFINED_OBJECT_FORMAT, fileSize, 0, 0, filename);

        let sendObjInfo2 = new mtp_container(0);
        sendObjInfo2.setOperation(SEND_OBJECT_INFO);
        sendObjInfo2.setTransactionID(MTPDevice.transactionID);
        sendObjInfo2.setParams(0, 0, 0, 0, 0);
        sendObjInfo2.setTransactionType(CONTAINER_TYPE_DATA);
        sendObjInfo2.containerArrayLength = 12 + fileInfo.container_array.length + fileInfo.filename_array.length + fileInfo.dateModArray.length;
        sendObjInfo2.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, new Uint8Array([...sendObjInfo2.container_array, ...fileInfo.container_array, ...fileInfo.filename_array, ...fileInfo.dateModArray]));
        return uploadFileInfoPromise;
    }

    async uploadFile(MTPDevice, storageObject, newObjectID, fileBytes, progressBar)
    {
        let result = MTPDevice.receivePackets(MTPDevice, 1);

        let uploadFilePromise = new Promise(function(resolve)
        {
            result.then((receivedPacket) => {
                resolve(true);
                console.log(receivedPacket);
                if ((receivedPacket[0][7] << 8 | receivedPacket[0][6]) === MTP_OK)
                {
                    resolve(true);
                }
                else
                {
                    throw("File upload unsuccessful!");
                }
            }).catch((err) => {
                console.log(err);
            })
        })

        let reqSendObject = new mtp_container(0);
        reqSendObject.setTransactionType(MTP_CONTAINER_TYPE_COMMAND);
        reqSendObject.setTransactionID(MTPDevice.transactionID++);
        reqSendObject.setOperation(SEND_OBJECT);
        reqSendObject.setParams(0, 0, 0, 0, 0);
        reqSendObject.pack();
        MTPDevice.device.transferOut(MTPDevice.endpointOut, reqSendObject.container_array);

        reqSendObject.setTransactionType(CONTAINER_TYPE_DATA);
        reqSendObject.containerArrayLength = fileBytes.length + 12;
        reqSendObject.pack();

        let end = 0;
        let i = 0;

        while (i < fileBytes.length)
        {
            if ((i + 512) > fileBytes.length) {
                end = fileBytes.length;
            } else {
                end = i + 512;
                if (i === 0)
                {
                    end = i + 500;
                }
            }
            let sliced = fileBytes.slice(i, end);
            if (i === 0)
            {
                await MTPDevice.device.transferOut(MTPDevice.endpointOut, new Uint8Array([...reqSendObject.container_array, ...sliced]));
            }
            else
            {
                await MTPDevice.device.transferOut(MTPDevice.endpointOut, sliced);
            }
            i = end;

            /* Update progress bar */
            progressBar.value = (end / fileBytes.length) * 100;
         }
        return uploadFilePromise;
    }
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
