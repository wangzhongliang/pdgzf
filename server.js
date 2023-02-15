const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const config = require('./config.json');

const myQualification = config.qualification;
const baiduAK = config.baiduAK;
const company = config.company;
console.log('my qualification: '+ myQualification);
const app = express();
const port = 3000;

// email
var transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure:true,
    auth: {
      user: '1085133704@qq.com',
      pass: 'mxroazsuujvojadf'
    }
});

transporter.verify((err, success) => {
    if (err){
        console.error(err);
        return
    }
    console.log('Your config is correct');
});

const tdStyle = 'style="border: 1px solid #dddddd;text-align: left;padding: 8px;"';

app.get('/', (req, res) => {
  res.send('Hello World!')
})
app.get('/geo', (req, res) => {
    getTableAndSendEmail().then(html=>{
        res.send('get')
    }).catch(err=>{
        res.send('not get')
    })
});

// 每天11点和20点定时推送
const job1 = schedule.scheduleJob('00 00 11 * * *', function(){
    getTableAndSendEmail().then(html=>{
        console.log('email send')
    }).catch(err=>{
        console.error(err)
    })
});
const job2 = schedule.scheduleJob('00 00 20 * * *', function(){
    getTableAndSendEmail().then(html=>{
        console.log('email send')
    }).catch(err=>{
        console.error(err)
    })
});

function getBestRouteDuration(origin, destination){
    return new Promise((resolve, reject)=>{
        axios.get("https://api.map.baidu.com/directionlite/v1/transit", {
            params: {
                origin: origin.map(e=>e.toFixed(5)).join(','), // 纬度在前，经度在后
                destination: destination.map(e=>e.toFixed(5)).join(','),
                ak: baiduAK
            }
          }).then(res=>{
            if(res.data.message==='ok'){
                const routes = res.data.result.routes;
                resolve({
                    duration: routes[0].duration,
                    distance: routes[0].distance,
                    price: routes[0].price
                })
            }
            else{
                console.error(res.data.message);
                reject(res.data.message);
            }
            
          }).catch(err=>{
            console.error(err);
            reject(err);
          })
    })
}

function getHouses(type,pageSize=10){
    const params = {
        pageIndex: 0,
        pageSize: pageSize,
        where:{
            keywords:"",
            typeName: type // 2: 一室一厅 3: 两室 4: 两室一厅
        }
    }
    const config = {
        headers: {
            Cookie: "SECKEY_ABVK=ee1OUB1Ov94g3Yw8OQYnJ/h4tHgz38SpLHtEOAc7xYg%3D; BMAP_SECKEY=tIs4VB8LjSU3yO-kmPUqfkuA_uAhnCXoV34osJPjDjH2UuPRaOOgbdwBH2qNcNeBQ2C4IoP1Wf-5VdmlzwG2bYIU4SirH0zzMLyUgY-7g4Eq82RUD31ueKldHPyOwnx5_AfmqM_xwOUJGrHRGC9lliTdygP3MJN4U7MiAsihx21suBJmpihZLACCiNComJIB; userInfo=U2FsdGVkX183TrxLX87zR9HW308SSVPqVUCljQxKi1kYxa1fn4tu/srPRgZwkIUFT+hNkNT+0ukrtItT5L9cYwOgkHrviXHph40aoGVG6OvW1C/oA5qXHJ4NL+dF7RHooLlb3Br8xesBsyUYAQwcbTbQ3fkTFkMAhoHGnfhb8ip7mQJMjSDQ21EcZ6DI8vY6Xaj3QGViFvjHzPbWBONsNsCv2WDpJMZa0rtysGwgwa/ktt2DNwm02HfFRqO7TzQ2OPDYbVB3nkMGBahu4v5K6R0MdaZ1jAX1ydzkanye9MRqoL2+DKET+trKxYhQQEh1V14vZv+dlFifxfO5UxgoZbeT9LvstdbXqAEQLchp3uBW6uVcEMbFOFFNfOZEDZ8b; JSESSIONID=44247D7313B20381597097174EA9DC9C",
            GZFAuthentication: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlYTY3MGFjYi1kYmI5LTQyOWItYmJkYy1mZWFmOTlkZThhZGUiLCJpYXQiOjE2NzUwNTM4NDksImV4cCI6MTY3NTE0MDI0OX0.WnLt44Wjsj2M8-7mjkW_PjkLeV9Rk1SL60ZkD-zi_rw"
        }
    };
    return new Promise((resolve, reject)=>{
        axios.post('https://select.pdgzf.com/api/v1.0/app/gzf/house/list', params).then(response=>{
            const result = response.data;
            if(result && result.success){
                const pageCount = result.data.pageCount;
                const totalCount = result.data.totalCount;
                const list = result.data.data;
                if(pageCount>1){
                    getHouses(type, totalCount).then(list=>{
                        resolve(list);
                    }).catch(err=>{
                        reject(err)
                    })
                    return;
                }
                if(pageCount>0){
                    resolve(list);
                }
                else{
                    resolve([]);
                }
                return;
            }
            reject("no result");
        }).catch(err=>{
            reject(err)
        })
    })
    
}

function sendEmail(html){
    const mailOptions = {
        from: '"提醒" <1085133704@qq.com>',
        to: '372085922@qq.com',
        subject: '浦东公租房定时提醒',
        // text: text,
        html:html
    };
      
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.error("Email fail to send")
            console.error(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}
    
function getTableAndSendEmail(){
    const types = [{
        type:"2",
        name:"一室一厅",
        list:[]
    },{
        type:"3",
        name:"两室",
        list:[]
    },{
        type:"4",
        name:"两室一厅",
        list:[]
    }];
    const promises = types.map(ele=>{
        return getHouses(ele.type)
    });
    return new Promise((resolve,reject)=>{
        Promise.all(promises).then(async lists=>{
            for(let index in lists){
                const list = lists[index];
                if(list && list.length>0){
                    for(let ele of list){
                        let myPosition = 0;
                        // 申请人排序
                        ele.queue.sort((a,b)=>parseInt(a.qualification.code)-parseInt(b.qualification.code))
                        for(let people of ele.queue){
                            myPosition++;
                            // console.log(people.qualification.code)
                            if(parseInt(people.qualification.code)>myQualification){
                                break;
                            }
                        }
                        // 小区名
                        const propertyName = ele.propertyName;
                        const longitude = ele.project.longitude;
                        const latitude = ele.project.latitude;
    
                        const type = types[index];
                        // console.log(type.name);
                        try{
                            const res = await getBestRouteDuration([latitude,longitude],[company.latitude, company.longitude]);
                            type.list.push(`<tr><td ${tdStyle}>${ele.address}</td><td ${tdStyle}>${ele.area} ㎡</td><td ${tdStyle}>${ele.rent}</td><td ${tdStyle}>${myPosition}/${ele.queueCount}</td><td ${tdStyle}>${(res.duration/60).toFixed(0)} min</td></tr>`)
                        }
                        catch{
                            type.list.push(`<tr><td ${tdStyle}>${ele.address}</td><td ${tdStyle}>${ele.area} ㎡</td><td ${tdStyle}>${ele.rent}</td><td ${tdStyle}>${myPosition}/${ele.queueCount}</td><td ${tdStyle}>未查到路线</td></tr>`)
                        }
                    }
                }
            }
            // console.log(JSON.stringify(types));
            const header = `<tr><th ${tdStyle}>地址</th><th ${tdStyle}>面积</th><th ${tdStyle}>租金</th><th ${tdStyle}>排名</th><th ${tdStyle}>通勤时长</th></tr>`
            const html = types.map(ele=>`<div><p>${ele.name}</p><table>${header}${ele.list.join('')}</table></div>`).join('');
            sendEmail(html)
            resolve(html);
        }).catch(function (error) {
            console.error(error);
            reject(error)
        });
    })
}

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})