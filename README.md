# Loop-backend-API
Backend API for the personal CRM data-analytic platform, LOOP

## NodeJS Back-End Service
This service is designed to serve REST APIs, which enables the key features of LOOP, such as real-time connection heatmap, LinkedIn network and message integration, response rates, touch points, etc., which can reflect the real-time status of user's personal network connections, more specifically how well the users connect to their personal networks, with using time-series database KairosDB in Cassandra (currently paused due to the cost of AWS). 

Two backend servers were constructed for the platform. The REST APIs were hosted on Heroko, and KairosDB was hosted on AWS.  

Contact Person

| Name | Email |
| ----------------------|-----------------------------------------|
| Ding (Rockwell) Xiang | dingxiang2015@u.northwestern.edu |

### Note:
Since the cost of using the database on AWS was no longer covered by Northwestern University after Jun, 2019, the AWS machines held the database were temperarily paused. If you would like to try our platform (MVP), feel free to let me know.

### install dependencies:
```
npm install
```
### cd to the folder

### start
```
npm start
```
