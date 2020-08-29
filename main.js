async function downloadAsFile()
{
    let fileBlob = await downloadFile(device, 1, 1);
    let url = window.URL.createObjectURL(fileBlob);

    const file_element = document.createElement("a");
    file_element.href = url;
    let filename = "README.txt";
    file_element.download = filename.split("\n")[0];
    file_element.click();
}

async function deleteFile()
{
    await deleteObject(device, 1, 1);
}