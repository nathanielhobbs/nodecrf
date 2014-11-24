"use strict";

var fs = require('fs');
var async = require('async');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var trainingFile, templateFile;
var templateArray = []; // will be defined in setTemplateArray
var featureCount = 0;

if(process.argv[1] === 'node' && process.argv.length !== 4){
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

	createFeatures(trainingFile, templateFile, function(err, result){
		if (err) throw err;
	});
}

module.exports.generateFeatures = createFeatures;
module.exports.getLabels = getLabelList;

function createFeatures (trainingFile, templateFile, callback) {
	verifyTrainingAndTemplate(trainingFile, templateFile);

	console.time('Generate Features')

	featureCount = 0;
	//open training file
	fs.readFile(trainingFile, 'utf8', function(error, trainingData) {
		if(error){
			return callback(error);
		}

		var data = trainingData.split('\n');
		var dataMatrix = [];
		for(var i = 0; i<data.length; i++){
			dataMatrix[i] = data[i].split(/\s/);
		}

		// get list of all labels that are in training data
		var labelList = getLabelList(dataMatrix);				

		// open template file
		fs.readFile(templateFile, 'utf8', function (error, templateData) {
			if(error) {
				return callback(error);
			}

			// First look at template file to see which features we care about in the training file
			var templateDataArray = templateData.split('\n'); 
			buildTemplateArray(templateDataArray, function(error, templateArray){
				if(error)
					return callback(error)

				distributedGenerateFeatures(templateArray, dataMatrix, trainingFile, labelList, function(labeledFeatures){
					printSummary();
					// console.log(labeledFeatures)
					return callback(null,labeledFeatures);

					// fs.writeFile('features.txt', JSON.stringify(labeledFeatures), 'utf8', printSummary(callback))
				});
			});
		});
	});
}

function distributedGenerateFeatures(templateArray, dataMatrix, trainingFile, labelList, callback){
	var expandedFeatures = {};
	var allFeaturesGenerated = false;
	var labeledFeatures = [];
	var allFeaturesLabeled = false;
	var featureResponseCount = 0;
	var labelResponseCount = 0;

	if (cluster.isMaster) {
		var dataMatrixRanges = [];
		// fork workers and set ranges for dataMatrix
		for (var i = 0; i < numCPUs; i++){
			cluster.fork();
			dataMatrixRanges.push(Math.ceil(dataMatrix.length/numCPUs * (i+1)))
			console.log(dataMatrixRanges[i])
		}

		// for macro decoding
		var currentFeatureMacroIndex = 0;
		var nextDataMatrixIndex = 0;

		// for feature labeling
		var currentFeatureIndex = 0;
		var expandedFeaturesArray = [];

		// create methods for how to respond to a message received from worker
		Object.keys(cluster.workers).forEach(function(id) {
			cluster.workers[id].on('message', function(msg){
				// handle the reception of a feature request result from worker
				if(msg.featureResults){
					var featureArray = msg.featureResults.decodedMacroArray;
					for(var i = 0; i < featureArray.length; i++){
						var decodedMacro = featureArray[i];
						featureResponseCount++;
						if(decodedMacro !== ''){
							expandedFeatures[decodedMacro] = msg.featureResults.macroIndex;
						}
					}					

					// we expect to receive the number of template macros * the length of the data matrix responses before being finished.
					if(featureResponseCount === templateArray.length * dataMatrix.length){ 
						allFeaturesGenerated = true;
						for(var feature in expandedFeatures){
							// console.log('feature: ' + feature + ', expandedFeatures[feature]: ' + expandedFeatures[feature])
							expandedFeaturesArray.push({ decodedFeature: feature, macroIndex: expandedFeatures[feature]})
						}
					}
				}

				// handle the reception of a label request result from worker
				if(msg.labelResults){
					labelResponseCount++;
					for(var i = 0; i < msg.labelResults.length; i++){
						labeledFeatures.push(msg.labelResults[i])
						featureCount++;
					}

					if(labelResponseCount === expandedFeaturesArray.length){
						return callback(createFeaturesObject(labeledFeatures));
					}
				}

				// find next macro to be decoded to be decoded and send a message to a worker to do the work.
				if(!allFeaturesGenerated){
					if(nextDataMatrixIndex < dataMatrixRanges.length){
						if(currentFeatureMacroIndex < templateArray.length){
							// create an object to send to the worker that includes all the information it needs to do its task
							var featureInfo = {
								macroIndex : currentFeatureMacroIndex
								, sampleBeginIndex : dataMatrixRanges[nextDataMatrixIndex-1]
								, sampleEndIndex : dataMatrixRanges[nextDataMatrixIndex]
								// , originalMacro : templateArray[currentFeatureMacroIndex]
							};
							if(nextDataMatrixIndex === 0){
								featureInfo.sampleBeginIndex = 0;
							}

							// send message to worker to decode the macro 
							// console.log('sending to worker: ' + JSON.stringify(featureInfo))
							cluster.workers[id].send({featureRequest: featureInfo});
							currentFeatureMacroIndex++;
						}
						else{ // once the current macro has been decoded for the entire dataMatrix, go on to the next macro
							nextDataMatrixIndex++;
							currentFeatureMacroIndex = 0;
							cluster.workers[id].send({keepAlive: 'keep message passing going'});
						}
					}
				}
				// once all the macros have been decoded, add labelling to them
				else if(allFeaturesGenerated && !allFeaturesLabeled){
					if(currentFeatureIndex < expandedFeaturesArray.length){
						var labelRequest = {
							macroIndex: expandedFeaturesArray[currentFeatureIndex].macroIndex
							, decodedMacro: expandedFeaturesArray[currentFeatureIndex].decodedFeature 
						};

						// send message to worker to take the decoded macro and create features for every label sequence.
						cluster.workers[id].send({ labelRequest: labelRequest });
						currentFeatureIndex++;
					}
				}
			});
		});

		// In case the worker dies!
		cluster.on('exit', function(worker, code, signal) {
			// if worker does not either exit normally or killed by the master, restart the worker
			// Exit code 143 corresponds to SIGTERM, which is the signal sent by default when you run kill <pid>
			if(code !== 0){
				console.log('worker %d died (%s). restarting...', worker.process.pid, signal || code);
				cluster.fork();
			}
			else
				console.log('worker exiting')
		});
	}
	else if (cluster.isWorker){		
		// send first message to start message passing 
		process.send({firstContact: 'Ready to receive feature Requests'})

		// Receive data from master for info to decode next macro chiain and send result back to master
		process.on('message', function(msg) {

			if(msg.featureRequest){
				var originalMacro = templateArray[msg.featureRequest.macroIndex];
				var decodedMacroArray = [];
				var startIndex = msg.featureRequest.sampleBeginIndex;
				var endIndex = msg.featureRequest.sampleEndIndex;

				for(var i = startIndex; i < endIndex; i++){
					decodedMacroArray.push(decodeMacroChain(originalMacro, dataMatrix, i));
				}
				
				process.send({featureResults: {decodedMacroArray: decodedMacroArray, macroIndex: msg.featureRequest.macroIndex} })
			}

			if(msg.labelRequest){
				var decodedMacro = msg.labelRequest.decodedMacro;
				var originalMacro = templateArray[msg.labelRequest.macroIndex];

				process.send({labelResults: labelIndividualFeature(originalMacro, decodedMacro, labelList)});
			}

			if(msg.keepAlive){
				process.send({keepAlive: 'keeping message passing going'})
			}

			if(msg.hasOwnProperty('kill')){
				process.exit(msg.kill)
			}
		});
	}
}

// takes macro chain and returns its decoded value at the given index.
function decodeMacroChain(featureMacro, dataMatrix, index){
	var macroList = featureMacro.match(/%x\[[-]?\d+,\d+\]/g);
	var featurePrefix = featureMacro.substring(0,featureMacro.indexOf(':')+1);
	var decodedMacroSequence = '';

	for(var j=0; j<macroList.length;j++){
		var columnStartIndex = macroList[j].indexOf(',')+1;
		var columnEndIndex = macroList[j].indexOf(']');
		var rowStartIndex = macroList[j].indexOf('[')+1;
		var rowEndIndex = macroList[j].indexOf(',');
		var currentMacroColumn = parseInt(macroList[j].substring(columnStartIndex, columnEndIndex), 10);
		var currentMacroRow = parseInt(macroList[j].substring(rowStartIndex, rowEndIndex), 10);
		var relativePositionInSample;
		var sampleNumber = 0;
		var decodedMacroValue = '';

		if(!dataMatrix[index-1] || dataMatrix[index-1][0] === '' || index === 0)
			relativePositionInSample = 0;
		else
			relativePositionInSample++;

		// check for boundry conditions for macro (i.e. for first word in training doc with template entry %x[-1,0])
		if(currentMacroRow+relativePositionInSample < 0){
			decodedMacroValue = '_B'+(relativePositionInSample+currentMacroRow); // will result in value of the form e.g. _B-1 (where _B-1 is the token before the start of a sample)
		}
		// check for boundry condition when currentMacroRow is looking past last word in document
		else if(currentMacroRow+index >= dataMatrix.length){
			decodedMacroValue = '_B+'+(currentMacroRow+index-dataMatrix.length+1); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
		}
		// check for boundry condition when currentMacroRow is looking past last word in sample
		else if(macroOvershootOfSampleLength(dataMatrix, index, currentMacroRow) > 0){
			var endOfSamplePosition = macroOvershootOfSampleLength(dataMatrix, index, currentMacroRow);
			decodedMacroValue = '_B+'+(currentMacroRow+index-endOfSamplePosition); // will result in value of the form e.g. _B+1 (where _B+1 is the token after the end of a sample)
		}
		else if (!dataMatrix[index+currentMacroRow]){
			return null;
		}
		// throw away conditions
		else if(!dataMatrix[index]
				|| dataMatrix[index][0] === ''  	// an empty value shouldn't have any features
				|| dataMatrix[index+currentMacroRow][0] === ''  	// features should not be created using the boundry spaces between samples
				|| (featurePrefix.match(/^B/) && currentMacroRow+relativePositionInSample < 0))  // bigram features shouldn't be created for words on the edge of the sample.
		{ 
			//keep track of sample number for labeling compound featueres
			if(dataMatrix[index] === ''){
				sampleNumber++; 
			}
			continue;
		}
		//else the standard case
		else{ 
			decodedMacroValue = dataMatrix[index+currentMacroRow][currentMacroColumn];
		}

		if(j === 0){
			decodedMacroSequence = featurePrefix + decodedMacroValue;
		}
		else{
			decodedMacroSequence += '/' + decodedMacroValue;
		}
	}
	return decodedMacroSequence;
}

function labelIndividualFeature(originalMacro, decodedMacro, labelList){
	var labeledFeaturesArray = [];
	var expandedFeatureObject = {};

	// label bigram features
	if(decodedMacro.match(/^B/)){
		for(var k=0; k < labelList.length; k++){
			for(var l=0; l< labelList.length; l++){
				labeledFeaturesArray.push(originalMacro + '/' + 
					decodedMacro + '/' + 
					labelList[k] + '/' +
					labelList[l]
					);
			}
		}
	} // label unigram features
	else if(decodedMacro.match(/^U/)){
		for(var k=0; k < labelList.length; k++){
				labeledFeaturesArray.push(originalMacro + '/' +
					decodedMacro + '/' + 
					labelList[k]
					);
		}
	}
	return labeledFeaturesArray;
}

function buildTemplateArray(templateDataArray, callback){
	var templateArray = [];
	var foundFeature = false;
	for(var i = 0; i < templateDataArray.length; i++){
		if(templateDataArray[i].match(/^U/) || templateDataArray[i].match(/^B/)){
			foundFeature = true;
			if(!templateDataArray[i].match(/%x\[[-]?[0-9]+,[-]?[0-9]+\]$/) && templateDataArray[i] !== 'B'){
				callback(new Error('Error with ' + templateDataArray[i]+ '. Please make sure each macro is of the form  %x[row,col].'));
			}
			templateArray.push(templateDataArray[i]);
		}
	}
	if(!foundFeature)
		return callback(new Error('No valid feature macros defined'));

	return callback(null, templateArray);
}

function getLabelList(dataMatrix){
	var labelList = [];
	for(var j = 0; j < dataMatrix.length; j++){
		// var trainingEntryArray = dataMatrix[j].split(/\s/);
		var currentLabel = dataMatrix[j][dataMatrix[j].length-1];

		if(labelList.indexOf(currentLabel) < 0 && currentLabel !== '')
			labelList.push(currentLabel);
	}
	return labelList;
}

function macroOvershootOfSampleLength(dataMatrix, absolutePosition, currentMacroRow){
	for(var i = absolutePosition; i <= absolutePosition+currentMacroRow; i++){
		if(dataMatrix[i][0] === ''){
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

function printSummary(){
	console.log('Number of Features Generated: ' + featureCount);
	console.timeEnd('Generate Features');
}

function createFeaturesObject(labeledFeatures){
	var featuresObject = {
		unigramFeatures : {},
		bigramFeatures : {}
	}

	for(var i = 0; i < labeledFeatures.length; i++){
		if(labeledFeatures[i].match(/^B/)){
			featuresObject.bigramFeatures[labeledFeatures[i]] = i;
		} 
		else if(labeledFeatures[i].match(/^U/)){
			featuresObject.unigramFeatures[labeledFeatures[i]] = i;
		}
	}
	return featuresObject	
}