import requests as req # to get image from the web
import shutil # to save it locally
metaBaseUrl = 'https://bafybeicvjtpp3lcmuya6u7pch2wqcvcomdgyiu5hljng4pkucms6lwq7qi.ipfs.dweb.link/'
cache = []

for i in range(5000):
    # Get image hash from Image URI object
    ii = i + 1
    id = str(ii)
    url = metaBaseUrl + id
    r = req.get(url, stream = True)
    raw = r.text
    head = raw.split("ipfs://")

    tail = head[1].split('/')


    hash = tail[0]
    # print('hash ', hash)
    img = tail[1].split('"')
    imgHash = img[0]
    # print('imgHash ', imgHash)

    # # pass the hash to a new link to request
    imgUrl = 'https://ipfs.io/ipfs/' + hash + '/' + imgHash
    print('Download #', i + 1)

    filename = 'images/GEMMA ' + id + '.jpg'

    # use a new request to download the image
    imgReq = req.get(imgUrl, stream = True )

    if imgReq.status_code == 200:

        # Set decode_content value to True, otherwise the downloaded image file's size will be zero.
        imgReq.raw.decode_content = True
        
        # Open a local file with wb ( write binary ) permission.
        with open(filename,'wb') as f:
            shutil.copyfileobj(imgReq.raw, f)
            
        print('Image sucessfully Downloaded: ',filename)
    else:
        print('Image Couldn\'t be retreived')



