var featureGenerator = require('../featureGenerator.js');

// featureGenerator.generateFeatures('testTraining.data', 'invalidTemplate1');

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

	test.throws(function () { featureGenerator.generateFeatures('testTraining.data', 'invalidTemplate1', test.done()); } //TODO: Add Callback
		, 'No valid feature macros defined');

	// test.doesNotThrow(function () { featureGenerator.generateFeatures('testTraining.data', 'testTemplate'); }
	// 	, 'Both a training file and a template file are required.');
	
};