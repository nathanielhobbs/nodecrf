var featureGenerator = require('../featureGenerator.js');
var path = require('path');

// featureGenerator.generateFeatures('testTraining.data', 'invalidTemplate1', function(error, result){
// 	if(error)
// 		console.log(error);
// 	console.log(result)
// });

exports.testInvocations = function (test){
	// test.throws(function () { featureGenerator.generateFeatures(); }
	// 	, 'Both a training file and a template file are required.');

	// test.throws(function () { featureGenerator.generateFeatures('some_file'); }
	// 	, 'Both a training file and a template file are required.');

	// test.throws(function () { featureGenerator.generateFeatures(null, 'testTemplate'); }
	// 	, 'Both training file and template file are required to be non-null');

	// test.throws(function () { featureGenerator.generateFeatures('testTraining.data', null); }
	// 	, 'Both training file and template file are required to be non-null');

	// test.throws(function () { featureGenerator.generateFeatures(null, null); }
	// 	, 'Both training file and template file are required to be non-null');
	var testPath = path.join(__dirname, 'testTraining.data');
	var templatePath = path.join(__dirname, 'invalidTemplate1');
	featureGenerator.generateFeatures(testPath, templatePath, function(error, result){
		test.equal(error, 'No valid feature macros defined.');
		test.done();
	});

	// test.doesNotThrow(function () { featureGenerator.generateFeatures('testTraining.data', 'testTemplate'); }
	// 	, 'Both a training file and a template file are required.');
};

