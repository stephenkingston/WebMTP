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

    setFileName(filename)
    {
        this.fileName = bin2String(filename)
    }

    initContainer(objectFormat, objectCompressedSize, associationType, associationDesc)
    {
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

/* Device class for all device operations */

class Device
{
    constructor()
    {
        this.endpointIn = 1;
        this.endpointOut = 2;
        this.device = null;
        this.sessionOpen = false;
        this.storageInfoObjects = new Array(0);
        this.objectInfoObjects = new Array(0);
    }

    getEndpoints()
    {
        this.endpointIn = 1;
        this.endpointOut = 1;
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
        try
        {
            this.device = await navigator.usb.requestDevice({ filters: [{}]});
            await this.device.open();
            await this.device.selectConfiguration(1);
            await this.device.claimInterface(0);
            return true;
        }
        catch
        {
            console.log("Error connecting to target.");
            return false;
        }
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
        openSession.setTransactionType(CONTAINER_TYPE_COMMAND);
        openSession.setOperation(OPEN_SESSION);
        openSession.setTransactionID(0x01);
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
        closeSessionRequest.setTransactionType(CONTAINER_TYPE_COMMAND);
        closeSessionRequest.setTransactionID(0x06);
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
                if ((receivedPackets[0][7] << 8 | receivedPackets[0][6]) === GET_STORAGE_IDS)
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
        getStorageIDS.setTransactionType(CONTAINER_TYPE_COMMAND);
        getStorageIDS.setOperation(GET_STORAGE_IDS);
        getStorageIDS.setTransactionID(0x02);
        getStorageIDS.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, getStorageIDS.container_array);

        return storageIDSPromise;
    }


    getFileObjects(MTPDevice, storageObject)
    {
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

                    MTPDevice.objectInfoObjects = new Array(0);
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
        reqObjHandles.setTransactionID(0x02);
        reqObjHandles.setTransactionType(CONTAINER_TYPE_COMMAND);
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
        getObjInfo.setTransactionType(CONTAINER_TYPE_COMMAND);
        getObjInfo.setOperation(GET_OBJECT_INFO);
        getObjInfo.setTransactionID(0x03);
        getObjInfo.setParams(fileObject.fileID, 0, 0, 0 , 0);
        getObjInfo.pack();

        MTPDevice.device.transferOut(MTPDevice.endpointOut, getObjInfo.container_array);

        return objectInfoPromise;
    }

    downloadFile(MTPDevice, storageObject, fileObject)
    {
        let results = MTPDevice.receivePackets(MTPDevice, 1);
        let downloadPromise = new Promise(function(resolve)
        {
            let firstObjectBuffer = new Uint8Array(0);
            let fileLength = null;
            let fileBlob = null;
            let objectBuffer = new Array(0);

            results.then((receivedPackets) => {
                firstObjectBuffer = receivedPackets[0];

                if ((firstObjectBuffer[7] << 8 | firstObjectBuffer[6]) === GET_OBJECT)
                {
                    fileLength = ((firstObjectBuffer[0] | (firstObjectBuffer[1] << 8) | (firstObjectBuffer[2] << 16) | (firstObjectBuffer [3] << 24)) - 12);
                    objectBuffer.push.apply(objectBuffer, firstObjectBuffer.slice(12, firstObjectBuffer.length));

                    let numberOfPacketsToBeReceived = Math.ceil((fileLength - objectBuffer.length)/512);
                    let restOfFilePromise = MTPDevice.receivePackets(MTPDevice, numberOfPacketsToBeReceived);
                    restOfFilePromise.then((restOfFile) =>
                    {
                        restOfFile.forEach((element) => {
                            objectBuffer.push.apply(objectBuffer, element);
                            console.log(objectBuffer);
                        })
                        let file_ = Uint8Array.from(objectBuffer);
                        fileBlob = new Blob([file_]);
                        resolve([true, fileBlob]);
                    })
                }
                else
                {
                    throw("Unhandled exception when initiating download.");
                }
            })
                .catch((err) => {
                    console.log("Error getting file. " + err)
                    resolve(false);
                });
        })

        /* Get ObjectInfo of all received handles */
        let reqObj = new mtp_container(1);
        reqObj.setTransactionID(0x04);
        reqObj.setTransactionType(CONTAINER_TYPE_COMMAND);
        reqObj.setOperation(GET_OBJECT);
        reqObj.setParams(fileObject.fileID, 0, 0, 0, 0);
        reqObj.pack()

        MTPDevice.device.transferOut(MTPDevice.endpointOut, reqObj.container_array);

        return downloadPromise;
    }

    deleteFile(MTPDevice, storageObject, fileObject)
    {
        let storageIndex = MTPDevice.storageInfoObjects.indexOf(storageObject);
        let fileIndex = MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects.indexOf(fileObject);
        let deletePromise = new Promise(function(resolve)
        {
            let result = MTPDevice.receivePackets(1);
            console.log(result);
            result.then((receivedPacket) => {
                console.log(receivedPacket);
                if ((receivedPacket[0][7] << 8 | receivedPacket[0][6]) === MTP_OK)
                {
                    MTPDevice.getFileObjects(MTPDevice, storageObject);
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
        delete_packet.setTransactionID(0x07);
        delete_packet.setOperation(DELETE_OBJECT);
        delete_packet.setTransactionType(CONTAINER_TYPE_COMMAND);
        delete_packet.setParams(MTPDevice.storageInfoObjects[storageIndex].objectInfoObjects[fileIndex].fileID, 0, 0, 0, 0);
        delete_packet.pack();
        MTPDevice.device.transferOut(MTPDevice.endpointOut, delete_packet.container_array);

        return deletePromise;
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

