FROM docker.1ms.run/electronuserland/builder:22-03.25

# set mirror, don't use npm config set, error: `electron_mirror` is not a valid npm option
RUN npm config set registry https://registry.npmmirror.com && \
    echo "electron_mirror=https://cdn.npmmirror.com/binaries/electron/" >> /root/.npmrc && \
    echo "electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/" >> /root/.npmrc

RUN wget -P /tmp/phantomjs https://mirrors.huaweicloud.com/phantomjs/phantomjs-2.1.1-linux-x86_64.tar.bz2

RUN apt-get update
RUN apt-get install rpm
RUN apt-get install python3-dev -y

RUN wget http://bootstrap.pypa.io/get-pip.py
RUN python3 get-pip.py

WORKDIR /project
COPY . .
RUN npm install
RUN npm run postinstall
RUN npm run build
RUN ls -la /project/dist && echo "build done"
