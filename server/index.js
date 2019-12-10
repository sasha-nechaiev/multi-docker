const keys = require('./keys');

// express app setup
const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyparser.json());


// Postrges setup
const { Pool } = require('pg'); 
const pgClient = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
pgClient.on('error', () => console.log('Log pg connection'));

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(err => console.log(err));

// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// express route handlers
app.get('/', (req, res) => {
    res.send('Hi')
})

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * FROM  VALUES');
    res.send(values.rows);
})

app.get('/values/current', (req, res) => {
    console.log('/values/current')
    redisClient.hgetall('values', (err, values) => {
        if(err) {
            res.send(500);
        }
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;

    if(+index > 50) {
        return res.status(422).send('Index too high');
    }

    console.log('hset', index)
    redisClient.hset('values', index, 'Nothing yet');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    res.send({working: true});
})

app.listen(5000, () => console.log('Listening on port 5000'));