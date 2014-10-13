"use strict";

var fs = require('fs');
var async = require('async');
var trainingFile, templateFile;
var templateArray = []; // will be defined in setTemplateArray
var featureCount = 0;

if(process.argv[1] === 'node' && process.argv.length>2 && process.argv.length<4){
	console.log("Invalid input.  Please specify a both a test file and template file name, e.g. node featureGenerator.js test.data template")
	throw error;
}

else if(process.argv.length === 4 && !process.argv[2].match(/\.data/)){
	console.log("Invalid input.  The test file should have a .data extension")
	throw error;
}

if(process.argv.length === 4){
	trainingFile = process.argv[2];
	templateFile = process.argv[3];

	createFeatures(trainingFile, templateFile);
}

module.exports.generateFeatures = createFeatures;

function createFeatures (trainingFile, templateFile, callback) {
	verifyTrainingAndTemplate(trainingFile, templateFile);

	console.time('Generate Features')

	featureCount = 0;
	//open training file
	fs.readFile(trainingFile, 'utf8', function(err, trainingData) {
		if(err) throw err;

		var trainingDataArray = trainingData.split('\n');

		// get list of all labels that are in training data
		var labelList = getLabelList(trainingDataArray);				

		// open template file
		fs.readFile(templateFile, 'utf8', function (err, templateData) {
			if(err) {
				throw err;
			}

			// First look at template file to see which features we care about in the training file
			var templateDataArray = templateData.split('\n'); 
			var templateArray = buildTemplateArray(templateDataArray);

			// Look at training file and generate expanded features according to template macros
			var expandedFeaturesObject = buildFeatures(templateArray, trainingDataArray, labelList);
			
			// console.log(expandedFeaturesObject)

			fs.writeFile('features.txt', JSON.stringify(expandedFeaturesObject), 'utf8', callback)
			console.log('Number of Features Generated: ' + featureCount)
			console.timeEnd('Generate Features')
		});
	});
}

function buildFeatures(templateArray, trainingDataArray, labelList){
	var expandedFeatures = {};
	for(var i=0; i<templateArray.length; i++){
		var macroList = templateArray[i].match(/%x\[[-]?\d+,\d+\]/g);
		var featurePrefix = templateArray[i].substring(0,templateArray[i].indexOf(':')+1);
		var unlabeledFeatures = [];
		var expandedMacroFeatures = [];

		var step = 0;

		if(templateArray[i] !== 'B')
			unlabeledFeatures = buildFeaturesFromMacros(macroList, trainingDataArray, featurePrefix);
		else
			unlabeledFeatures.push('B') // this is a special feature template that only features for y_i-1 and y_i label combinations, there is no macro

		// console.log("unlabeled Features:")
		// console.log(unlabeledFeatures)
		expandedMacroFeatures = labelFeatures(unlabeledFeatures, labelList);
		// console.log(expandedMacroFeatures)

		for (var feature in expandedMacroFeatures) { 
			featureCount++;
			expandedFeatures[feature] = expandedMacroFeatures[feature]; 
		}
	}
	return expandedFeatures;
}

function buildFeaturesFromMacros(macroList, trainingDataArray, featurePrefix){
	var unlabeledFeatures = [];
	for(var j=0; j<macroList.length;j++){
		var columnStartIndex = macroList[j].indexOf(',')+1;
		var columnEndIndex = macroList[j].indexOf(']');
		var rowStartIndex = macroList[j].indexOf('[')+1;
		var rowEndIndex = macroList[j].indexOf(',');
		var currentMacroColumn = parseInt(macroList[j].substring(columnStartIndex, columnEndIndex), 10);
		var currentMacroRow = parseInt(macroList[j].substring(rowStartIndex, rowEndIndex), 10);
		var uniqueColumnEntries = {};
		var decodedMacroValue = '';
		var relativePositionInSample;
		var sampleNumber = 0;

		// iterate through each line of the trainingDataArray (i.e. each entry in the training data set)
		// and create a unique feature for that entry based on the current macro
		for(var absolutePosition = 0; absolutePosition < trainingDataArray.length; absolutePosition++){

			if(trainingDataArray[absolutePosition-1] === '' || absolutePosition === 0)
				relativePositionInSample = 0;
			else
				relativePositionInSample++;

			// check for boundry conditions for macro (i.e. for first word in training doc with template entry %x[-1,0])
			if(currentMacroRow+relativePositionInSample < 0){
				decodedMacroValue = '_B'+(relativePositionInSample+currentMacroRow); // will result in value of the form e.g. _B-1 (where _B-1 is the token before the start of a sample)
			}
			// check for boundry condition when currentMacroRow is looking past last word in document
			else if(currentMacroRow+absolutePosition >= trainingDataArray.length){
				decodedMacroValue = '_B+'+(currentMacroRow+absolutePosition-trainingDataArray.length+1); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
			}
			// check for boundry condition when currentMacroRow is looking past last word in sample
			else if(macroOvershootOfSampleLength(trainingDataArray, absolutePosition, currentMacroRow) > 0){
				var endOfSamplePosition = macroOvershootOfSampleLength(trainingDataArray, absolutePosition, currentMacroRow);
				decodedMacroValue = '_B+'+(currentMacroRow+absolutePosition-endOfSamplePosition); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
			}
			// throw away conditions
			else if(trainingDataArray[absolutePosition] === ''  	// an empty value shouldn't have any features
					|| trainingDataArray[absolutePosition+currentMacroRow] === ''  	// features should not be created using the boundry spaces between samples
					|| (featurePrefix.match(/^B/) && currentMacroRow+relativePositionInSample < 0))  // bigram features shouldn't be created for words on the edge of the sample.
			{ 
				//keep track of sample number for labeling compound featueres
				if(trainingDataArray[absolutePosition] === ''){
					sampleNumber++; 
				}
				continue;
			}
			//else the standard case
			else{ 
				var trainingEntryArray = trainingDataArray[absolutePosition+currentMacroRow].split(/\s/);
				decodedMacroValue = trainingEntryArray[currentMacroColumn];
			}

			// keep track to a temperary expandedFeature until each of the macros have been iterated through
			if(j == 0){
				unlabeledFeatures.push(featurePrefix + decodedMacroValue);
			}
			else{
				// console.log('absolutePosition: ' + absolutePosition)
				// console.log('pushing ' + '/'+ decodedMacroValue + ' after ' + unlabeledFeatures[absolutePosition-sampleNumber])
				unlabeledFeatures[absolutePosition-sampleNumber] += '/' + decodedMacroValue;
			}

		}	
	}
	return unlabeledFeatures;
}

function labelFeatures(unlabeledFeatures, labelList){
	var expandedFeaturesObject = {};
	for(var j = 0; j< unlabeledFeatures.length; j++){
		var thisFeature = unlabeledFeatures[j];
		if(thisFeature.match(/^B/)){
			for(var k=0; k < labelList.length; k++){
				for(var l=0; l< labelList.length; l++){
					if (!expandedFeaturesObject.hasOwnProperty(thisFeature + ': ' +  labelList[l] + ', ' + labelList[k])) {
						expandedFeaturesObject[thisFeature + ': ' +  labelList[l] + ', ' + labelList[k]] = '';
					}
				}
			}
		}
		else if(thisFeature.match(/^U/)){
			// console.log(labelList)
			for(var k=0; k < labelList.length; k++){
				if (!expandedFeaturesObject.hasOwnProperty(thisFeature + ': n/a, ' + labelList[k])) {
					expandedFeaturesObject[thisFeature+ ': n/a, '  + labelList[k]] = '';
				}
			}
		}
	}
	return expandedFeaturesObject;
}

function buildTemplateArray(templateDataArray){
	var templateArray = [];
	var foundFeature = false;
	for(var i = 0; i < templateDataArray.length; i++){
		if(templateDataArray[i].match(/^U/) || templateDataArray[i].match(/^B/)){
			foundFeature = true;
			if(!templateDataArray[i].match(/%x\[[-]?[0-9]+,[-]?[0-9]+\]$/) && templateDataArray[i] !== 'B'){
				throw new Error('Error with ' + templateDataArray[i]+ '. Please make sure each macro is of the form  %x[row,col].');
			}
			templateArray.push(templateDataArray[i]);
		}
	}
	if(!foundFeature)
		throw new Error('No valid feature macros defined');

	return templateArray;
}

function getLabelList(trainingDataArray){
	var labelList = [];
	for(var j = 0; j < trainingDataArray.length; j++){
		var trainingEntryArray = trainingDataArray[j].split(/\s/);
		var currentLabel = trainingEntryArray[trainingEntryArray.length-1];

		if(labelList.indexOf(currentLabel) < 0 && currentLabel !== '')
			labelList.push(currentLabel);
	}
	return labelList;
}

function featureAlreadyInList(featureArray, featureObject){
	for(var i = 0; i < featureArray.length; i++){
		if( featureArray[i].feature === featureObject.feature 
			&& featureArray[i].currentLabel === featureObject.currentLabel
			&& featureArray[i].previousLabel === featureObject.previousLabel){
			return true;
		}
	}
	return false;
}

function macroOvershootOfSampleLength(trainingDataArray, absolutePosition, currentMacroRow){
	for(var i = absolutePosition; i <= absolutePosition+currentMacroRow; i++){
		if(trainingDataArray[i] === ''){
			return i-absolutePosition; 
		}
	}
	return -1;
}

function verifyTrainingAndTemplate(trainingFile, templateFile){
	if( !trainingFile || !templateFile)
		throw new Error('Both a training file and a template file are required to be set before envoking the feature generator.');

	if(trainingFile === null || templateFile === null)
		throw new Error('Both training file and template file are required to be non-null');

	if(!trainingFile.match(/\.data/))
		throw new Error('Invalid input.  The test file should have a .data extension');
}

// module.exports.setTrainingFile = function (trainingFile){
// 	if(!trainingFile){
// 		throw new Error('Must specify a training file');
// 	}

// 	if(trainingFile === null){
// 		throw new Error('Training file can not be null');
// 	}

// 	trainingFile = trainingFile;

// 	console.log('Training file set:')
// 	console.log(trainingFile)
// }

// module.exports.setTemplate = setTemplateFile; 

// function setTemplateFile(templateFile){
// 	console.log('Training file set:')
// 	console.log(trainingFile)
// 	if(!templateFile){
// 		throw new Error('Must specify a template file');
// 	}

// 	if(templateFile === null){
// 		throw new Error('Template file can not be null');
// 	}

// 	templateFile = templateFile;

// 	console.log('Template Set')

// 	// open template file and fill up templateArray
// 	// fs.readFile(templateFile, 'utf8', function (error, templateData) {
// 	// 	if(error) {
// 	// 		throw error;
// 	// 	}

// 	// 	var templateDataArray = templateData.split('\n'); 
// 	// 	templateArray = buildTemplateArray(templateDataArray);
// 	// });
// }