
var Input = function() {

};

Input.prototype.read = function(address) {
	console.log('Input read: ' + hex(address));
};

Input.prototype.write = function(address, data) {
	console.log('Input write: ' + hex(address) + ':' + bits(data, 8));
};