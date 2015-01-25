/**
 * 
 * load files and return matrix
 * 
 */

'use strict';

var fs = require('fs');

module.exports = Loader;

function Loader() {


};

Loader.prototype.loadTrain = function (filePath) {
	var data = [];
	var fileData = fs.readFileSync(filePath, {encoding: 'utf8'});
	if (!fileData)
		return null;
	fileData = fileData.split('\n');
	var len = fileData.length;
	for (var i = 0; i < len; i++) {
		if(fileData[i])
			data.push(fileData[i].split(/\s/g));
		else
			data.push([fileData[i]]);
	}
	return data;
};

Loader.prototype.loadTemplate = function(filePath) {
	var data = [];
	var fileData = fs.readFileSync(filePath,{encoding: 'utf8'});
	if (!fileData)
		return null;
	fileData = fileData.split('\n');
	var len = fileData.length, i;
	for (i = 0; i < len; i++) {
		if(fileData[i][0]!='#')
			data.push(fileData[i]);
	}
	return data;
};



