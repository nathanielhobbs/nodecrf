'use strict';

var Loader = require('../loader.js');
var loader = new Loader();

exports.testLoadTemplateFile = function (test) {
	var templates = loader.loadTemplate(__dirname + '/testTemplate');
	test.deepEqual(templates,[ 'U01:%x[0,0]', '', 'B00:%x[0,0]', 'B01:%x[0,0]/%x[1,0]' ]);
	test.done();
};

exports.testLoadTrainingFile = function (test) {
	var trainingData = loader.loadTrain(__dirname + '/testTraining.data');
	test.deepEqual(trainingData, [ 
	[ 'word1',
    'n',
    'false',
    'false',
    'false',
    'false',
    'false',
    'false',
    '3',
    'false',
    'false',
    '0',
    'uncategorized' ],
  [ 'word2',
    'n',
    'false',
    'false',
    'false',
    'false',
    'false',
    'false',
    '3',
    'false',
    'false',
    '0',
    'product' ],
  [ '' ],
  [ 'word3',
    'n',
    'false',
    'false',
    'false',
    'false',
    'false',
    'false',
    '3',
    'false',
    'false',
    '0',
    'uncategorized' ],
  [ 'word4',
    'n',
    'false',
    'false',
    'false',
    'false',
    'false',
    'false',
    '3',
    'false',
    'false',
    '0',
    'product' ] ]);
	test.done();
};