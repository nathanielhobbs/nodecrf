'use strict';

// the name maybe change later
// var computeGradients = require('./computeGradients');

var sylvester = require('sylvester');

module.exports = sgd;

function sgd (X, y, templateVector, theta, maxIter) {
	var resultObj = {};
	resultObj.theta = $M(theta);
	resultObj.likelihood = [];
	alpha = 1;

	for (var i = 0; i < maxIter; i++) {
		result = computeGradients(X, y, templateVector, resultObj.theta);
		resultObj.likelihood.push(result.likelihood);

		// theta(i) = theta(i) - alpha * gradient(i)
		resultObj.theta = resultObj.theta.subtract(result.theta.x(alpha));
	}	

	return resultObj;
};


