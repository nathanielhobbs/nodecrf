'use strict';

var fs = require('fs');
var async = require('async')

if (process.argv.length < 3) {
	var errorMessage = 'Invalid input.  Please specify a file name, e.g. node evaluateTestFile.js results.txt (results.txt is the output of the crf model)';
	console.log(errorMessage)
	throw error;
}

for (var i = 2; i < process.argv.length; i++) {
	fs.readFile(process.argv[i], 'utf8', function (err, data) {
		if (err) {
			throw err;
		}
		var dataArray = data.split('\n'); //sampleArray should be of the form [{tag:[],word:[],entity:[]},...,{}]
		var mismatchCounter = 0;
		var correctCounter = 0;

		for (var i = 0; i < dataArray.length; i++) {
			var values = dataArray[i].split('\t');
			var lastValueIndex = values.length - 1;

			if (values[lastValueIndex] === values[lastValueIndex - 1]) {
				correctCounter++;
			}

			if (values[lastValueIndex] && values[lastValueIndex] !== values[lastValueIndex - 1]) {
				console.log(i + ': not equal! ' + values[0] + ' predicted value: ' + values[lastValueIndex] + ', actual value: ' + values[lastValueIndex - 1])
				mismatchCounter++;
			}
		}

		console.log('Total number of mismatches: ' + mismatchCounter)
		console.log('Ratio of incorrect/correct: ' + mismatchCounter / correctCounter + '%')
	});
}
