Febriyan Adji Saputro - CF-004

##### Membuat Resource Group

```
az configure --defaults location=eastus
az group create -n rg-maribisnis
az configure --defaults group=rg-maribisnis
```

##### Membuat DNS Zone

```
az network dns zone create -n maribisnis.tik.my.id
az network dns zone show -n maribisnis.tik.my.id -o jsonc
```

##### Mengambil name server lalu konfigurasikan ke cloudflare

![image-20211130165211312](/home/febriyan/.config/Typora/typora-user-images/image-20211130165211312.png)

![image-20211130165453482](/home/febriyan/.config/Typora/typora-user-images/image-20211130165453482.png)

##### Pengecekan nameserver

![image-20211130165603616](/home/febriyan/.config/Typora/typora-user-images/image-20211130165603616.png)

##### Membuat Virtual Network dan Subnet

```
az network vnet create -n vnet-maribisnis --address-prefix 10.10.10.0/25
```

```
az network vnet subnet create -n sn-public --vnet-name vnet-maribisnis \
--address-prefixes 10.10.10.0/29
```

```
az network vnet subnet create -n sn-private --vnet-name vnet-maribisnis \
--address-prefixes 10.10.10.8/29 --disable-private-endpoint-network-policies true
```

```
az network vnet subnet create -n sn-public2 --vnet-name vnet-maribisnis \
--address-prefixes 10.10.10.16/29
```

##### Membuat Public IP Address

```
az network public-ip create -n pip-nextcloud --allocation-method Static -z 2 --sku Standard
```

![image-20211130173040950](/home/febriyan/.config/Typora/typora-user-images/image-20211130173040950.png)

##### Membuat DNS Record untuk IP publik

```
ID=$(az network public-ip show -n pip-nextcloud -o tsv --query "id")
```

```
az network dns record-set a create -n nextcloud --zone-name maribisnis.tik.my.id \
--target-resource $ID
```

![image-20211130203122826](/home/febriyan/.config/Typora/typora-user-images/image-20211130203122826.png)

##### Membuat NSG nextcloud

```
az network nsg create -n nsg-nextcloud
```

##### Membuat NIC nextcloud

```
az network nic create --vnet-name vnet-maribisnis --subnet sn-public \
-n nic-nextcloud --public-ip-address pip-nextcloud \
--network-security-group nsg-nextcloud
```

##### Membuat VM nextcloud

```
az vm create --name vm-nextcloud --image UbuntuLTS --size Standard_B1s \
--nics nic-nextcloud -z 2 
```

##### Mengizinkan port web nextcloud

```
az vm open-port -n vm-nextcloud --port "80,443"
```

##### Membuat storage account

```
az storage account create -n stmaribisnis --sku Standard_ZRS --default-action Deny
```

##### Membuat share untuk penyimpanan nextcloud

```
az storage share create -n nextcloud-data --account-name stmaribisnis
```

##### Mengambil access key

```
az storage account keys list -n stmaribisnis --query "[].value"
```

![image-20211130233334426](/home/febriyan/.config/Typora/typora-user-images/image-20211130233334426.png)

##### Membuat private endpoint untuk storage

```
ID=$(az storage account show -n stmaribisnis -o tsv --query "id")
```

```
az network private-endpoint create -n pe-storage \
--private-connection-resource-id $ID --connection-name my-conn \
--vnet-name vnet-maribisnis --subnet sn-private --group-id file
```

```
az network private-dns zone create -n privatelink.file.core.windows.net
```

```
az network private-dns link vnet create --zone-name privatelink.file.core.windows.net \
--name dnslink --virtual-network vnet-maribisnis --registration-enabled false
```

```
az network private-endpoint dns-zone-group create --endpoint-name pe-storage \
-n default --private-dns-zone privatelink.file.core.windows.net \
--zone-name privatelink_file_core_windows_net
```

##### Menyiapkan Azure Bastion untuk meremot vm nextcloud

```
az network public-ip create -n pip-bastion --sku Standard
```

```
az network vnet subnet create -n AzureBastionSubnet \
--address-prefixes 10.10.10.64/26 --vnet-name vnet-maribisnis
```

![image-20211201140558084](/home/febriyan/.config/Typora/typora-user-images/image-20211201140558084.png)

![image-20211201141357084](/home/febriyan/.config/Typora/typora-user-images/image-20211201141357084.png)

![image-20211201141418116](/home/febriyan/.config/Typora/typora-user-images/image-20211201141418116.png)

##### Install paket software nextcloud

```
sudo add-apt-repository ppa:ondrej/php
```

```
sudo apt update
```

```
sudo apt -y install apache2 mariadb-server php7.4 python-certbot-apache unzip php7.4-curl php7.4-gd php7.4-mbstring php7.4-zip php7.4-xml php7.4-mysql php7.4-intl php7.4-bz2 php7.4-imagick -y
```

##### konfigurasi database server nextcloud

```
sudo mysql_secure_installation
```

```
create database nextcloud;
```

```
create user nextclouduser@localhost identified by 'C8MV8Xvxxb9fyqVG';
```

```
grant all privileges on *.* to nextclouduser@localhost;
```

```
flush privileges;
```

##### konfigurasi web server apache nextcloud

```
sudo a2enmod rewrite headers env dir mime ssl
```

```
cat << EOF > /etc/apache2/sites-available/nextcloud.conf
 <VirtualHost *:80>
   ServerName nextcloud.maribisnis.tik.my.id
   DocumentRoot /var/www/nextcloud/
   Alias / "/var/www/nextcloud/"
   <Directory /var/www/nextcloud/>
     Require all granted
     AllowOverride All
     Options FollowSymLinks MultiViews
     <IfModule mod_dav.c>
       Dav off
     </IfModule>
   </Directory>
 </VirtualHost>
 EOF
```

```
sudo a2ensite nextcloud.conf
```

```
sudo a2dissite 000-default.conf
```

```
sudo systemctl reload apache2
```

```
certbot --apache -d nextcloud.maribisnis.tik.my.id -m febriyan.aji@gmail.com --agree-tos --redirect --staple-ocsp
```

##### Download nextcloud

```
wget https://download.nextcloud.com/server/releases/nextcloud-23.0.0.zip
```

```
unzip nextcloud-23.0.0.zip -d /var/www/
```

```
sudo chown -R www-data:www-data /var/www/nextcloud/
```

##### Mount file share nextcloud dari azure storage

```
sudo mkdir /var/www/nextcloud/data
if [ ! -d "/etc/smbcredentials" ]; then
sudo mkdir /etc/smbcredentials
fi
if [ ! -f "/etc/smbcredentials/stmaribisnis.cred" ]; then
    sudo bash -c 'echo "username=stmaribisnis" >> /etc/smbcredentials/stmaribisnis.cred'
    sudo bash -c 'echo "password=uGYBK4DWyRzHu7EXMyHVTQ3d3GIHN75H7A/cctG4ii0Pmpb0eeFvDgrdjlNkJ6wac/0Vo2JktwLJpkL094rOEQ==" >> /etc/smbcredentials/stmaribisnis.cred'
fi
sudo chmod 600 /etc/smbcredentials/stmaribisnis.cred

sudo bash -c 'echo "//stmaribisnis.file.core.windows.net/nextcloud-data /var/www/nextcloud/data cifs nofail,vers=3.0,credentials=/etc/smbcredentials/stmaribisnis.cred,dir_mode=0770,file_mode=0770,serverino,uid=33,gid=33" >> /etc/fstab'
sudo mount -t cifs //stmaribisnis.file.core.windows.net/nextcloud-data /var/www/nextcloud/data -o vers=3.0,credentials=/etc/smbcredentials/stmaribisnis.cred,dir_mode=0770,file_mode=0770,serverino,uid=33,gid=33
```

##### Install Nextcloud

```
sudo -u www-data php /var/www/nextcloud/occ maintenance:install --database "mysql" --database-name "nextcloud" --database-user "nextclouduser" --database-pass "C8MV8Xvxxb9fyqVG" --admin-user "admin" --admin-pass "DVPh5sCEzjKMtK9m"
```

```
sudo -u www-data php /var/www/nextcloud/occ config:system:set \
trusted_domains 1 --value=nextcloud.maribisnis.tik.my.id
```

##### pengujian nextcloud

![image-20211201004852103](/home/febriyan/.config/Typora/typora-user-images/image-20211201004852103.png)

![image-20211201005205649](/home/febriyan/.config/Typora/typora-user-images/image-20211201005205649.png)

![image-20211201005507563](/home/febriyan/.config/Typora/typora-user-images/image-20211201005507563.png)

![image-20211201005624908](/home/febriyan/.config/Typora/typora-user-images/image-20211201005624908.png)

##### Membuat SQL Server

```
az sql server create -n sql-maribisnis -u maribisnis -p nH64R2ZK97bPDfdj -e false
```

```
az configure --defaults sql-server=sql-maribisnis
```

##### Mengatur Private Endpoint SQL Server

```
ID=$(az sql server show -n sql-maribisnis --query "id" -o tsv)
```

```
az network private-endpoint create -n pe-sql \
--private-connection-resource-id $ID --connection-name sql-conn \
--vnet-name vnet-maribisnis --subnet sn-private --group-id sqlserver 
```

```
az network private-dns zone create -n privatelink.database.windows.net
```

```
az network private-dns link vnet create --zone-name privatelink.database.windows.net --name dnslink --virtual-network vnet-maribisnis --registration-enabled false
```

```
az network private-endpoint dns-zone-group create \
--endpoint-name pe-sql -n default --private-dns-zone privatelink.database.windows.net \
--zone-name privatelink_database_windows_net
```

##### Membuat SQL Database untuk website

```
az sql db create -n sqldb-orchardcms -z true --compute-model Serverless --auto-pause-delay 60 -f Gen5 -e GeneralPurpose -c 1 --bsr Zone
```

##### Membuat File Share untuk website

```
az storage share create -n orchardcms-data --account-name stmaribisnis
```

##### Membuat App Service Plan untuk website

```
az appservice plan create -n appplan-orchardcms --is-linux --sku P1V2
```

##### Membuat App Service untuk website

```
az webapp create -p appplan-orchardcms -n app-orchardcms -i orchardproject/orchardcore-cms-linux:latest
```

```
az webapp update -n app-orchardcms  --https-only true
```

```
az network dns record-set cname create -z maribisnis.tik.my.id -n web
```

```
az network dns record-set cname set-record -z maribisnis.tik.my.id -n web -c app-orchardcms.azurewebsites.net
```

```
az webapp config hostname add --hostname web.maribisnis.tik.my.id --webapp-name app-orchardcms
```

```
az webapp config ssl create --hostname web.maribisnis.tik.my.id -n app-orchardcms
```

```
THUMBPRINT=$(az webapp config ssl show --certificate-name web.maribisnis.tik.my.id -o tsv --query "thumbprint")
```

```
az webapp config ssl bind --certificate-thumbprint $THUMBPRINT -n app-orchardcms --ssl-type SNI
```

![image-20211201095141387](/home/febriyan/.config/Typora/typora-user-images/image-20211201095141387.png)

##### Menghubungkan website ke subnet public

```
az webapp vnet-integration add -n app-orchardcms --subnet sn-public2 --vnet vnet-maribisnis
```

```
az webapp config storage-account add -n app-orchardcms --custom-id data --storage-type AzureFiles --account-name stmaribisnis --share-name orchardcms-data --access-key uGYBK4DWyRzHu7EXMyHVTQ3d3GIHN75H7A/cctG4ii0Pmpb0eeFvDgrdjlNkJ6wac/0Vo2JktwLJpkL094rOEQ== --mount-path /app/App_Data
```

##### Konfigurasi website

![image-20211201103219125](/home/febriyan/.config/Typora/typora-user-images/image-20211201103219125.png)

##### pengujian website

![image-20211201104942692](/home/febriyan/.config/Typora/typora-user-images/image-20211201104942692.png)

![image-20211201105212008](/home/febriyan/.config/Typora/typora-user-images/image-20211201105212008.png)

##### Membuat App Plan untuk internal API

```
az appservice plan create -n appplan-internalapi --is-linux --sku P1V2
```

##### Membuat App Service untuk internal API

```
az webapp create -p appplan-internalapi -n app-internalapi --runtime "node|14-lts"
```

```
az webapp update -n app-internalapi  --https-only true                  
```

![image-20211201111910872](/home/febriyan/.config/Typora/typora-user-images/image-20211201111910872.png)

```
az network dns record-set cname create -z maribisnis.tik.my.id -n api
```

```
az network dns record-set cname set-record -z maribisnis.tik.my.id -n api -c app-internalapi.azurewebsites.net
```

```
az webapp config hostname add --hostname api.maribisnis.tik.my.id --webapp-name app-internalapi
```

```
az webapp config ssl create --hostname api.maribisnis.tik.my.id -n app-internalapi
THUMBPRINT=$(az webapp config ssl show --certificate-name api.maribisnis.tik.my.id -o tsv --query "thumbprint")
```

```
az webapp config ssl bind --certificate-thumbprint $THUMBPRINT -n app-internalapi --ssl-type SNI
```

![image-20211201112548309](/home/febriyan/.config/Typora/typora-user-images/image-20211201112548309.png)

##### Deploy souce code internal API

```
zip -r deploy.zip internal-api/
```

```
az webapp deploy -n app-internalapi --src-path deploy.zip
```

![image-20211201121601275](/home/febriyan/.config/Typora/typora-user-images/image-20211201121601275.png)

![image-20211201121620228](/home/febriyan/.config/Typora/typora-user-images/image-20211201121620228.png)

##### Membuat private endpoint untuk internal api

```
ID=$(az webapp show -n app-internalapi --query "id" -o tsv)
```

```
az network private-endpoint create -n pe-internalapi \
--private-connection-resource-id $ID --connection-name internalapi-conn \
--vnet-name vnet-maribisnis --subnet sn-private --group-id sites
```

```
az network private-dns zone create -n privatelink.azurewebsites.net
az network private-dns link vnet create --zone-name privatelink.azurewebsites.net --name dnslink --virtual-network vnet-maribisnis --registration-enabled false

az network private-endpoint dns-zone-group create --endpoint-name pe-internalapi -n default --private-dns-zone privatelink.azurewebsites.net --zone-name privatelink_azurewebsites_net
```

![image-20211201122425931](/home/febriyan/.config/Typora/typora-user-images/image-20211201122425931.png)

![image-20211201123005994](/home/febriyan/.config/Typora/typora-user-images/image-20211201123005994.png)

![image-20211201123131574](/home/febriyan/.config/Typora/typora-user-images/image-20211201123131574.png)

![image-20211201123321424](/home/febriyan/.config/Typora/typora-user-images/image-20211201123321424.png)

