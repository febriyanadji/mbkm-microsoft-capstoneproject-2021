var express = require('express');
var router = express.Router();

const employees = [
  {
    id: 1,
    name: 'Karyawan 1',
  },
  {
    id: 2,
    name: 'Karyawan 2',
  },
  {
    id: 3,
    name: 'Karyawan 3',
  },
  {
    id: 4,
    name: 'Karyawan 4',
  },
];
router.get('/', function (req, res, next) {
  res.json(employees);
});

module.exports = router;
