var express = require('express');
var router = express.Router();

const customers = [
  {
    id: 1,
    name: 'Pelanggan 1',
  },
  {
    id: 2,
    name: 'Pelanggan 2',
  },
  {
    id: 3,
    name: 'Pelanggan 3',
  },
  {
    id: 4,
    name: 'Pelanggan 4',
  },
];
router.get('/', function (req, res, next) {
  res.json(customers);
});

module.exports = router;
