import os
list = os.listdir('images/') # Relative link to images
dls = []
missing = []

for x in list: # Get list of downloaded IDs
    item = x.split()
    file = item[1]
    ext = file.split(".")
    idStr = ext[0]
    id = int(idStr)
    # print(id)
    dls.append(id)

for i in range(5000): # Put collection total
    if i not in dls:
        missing.append(i)

print(missing)
