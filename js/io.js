
var Io = function() {
	this.p1 = 0xFF;
	this.keys = {
		right: 39, left: 37, up: 38, down: 40,
		a: 90, b: 88, select: 86, start: 67
	};
};

Io.prototype.read = function(address) {
	switch(address) {
		case 0xFF00:
			return this.p1;
		default:
			throw 'Invalid input write @ ' + hex(address) + '.';
	}
};

Io.prototype.write = function(address, data) {
	switch(address) {
		case 0xFF00:
			this.p1 = this.p1 & 0xCF | data & 0x30;
			break;
		default:
			throw 'Invalid input write @ ' + hex(address) + ':' + bits(data, 8) + '.';
	}
};

Io.prototype.keyP14 = function(key, pressed) {
	switch(key) {
		case this.keys.right:
			this.p1 = this.p1 & 0xFE | (pressed ? 0 : 0x1);
			break;
		case this.keys.left:
			this.p1 = this.p1 & 0xFD | (pressed ? 0 : 0x2);
			break;
		case this.keys.up:
			this.p1 = this.p1 & 0xFB | (pressed ? 0 : 0x4);
			break;
		case this.keys.down:
			this.p1 = this.p1 & 0xF7 | (pressed ? 0 : 0x8);
			break;
	}
};

Io.prototype.keyP15 = function(key, pressed) {
	switch(key) {
		case this.keys.a:
			this.p1 = this.p1 & 0xFE | (pressed ? 0 : 0x1);
			break;
		case this.keys.b:
			this.p1 = this.p1 & 0xFD | (pressed ? 0 : 0x2);
			break;
		case this.keys.select:
			this.p1 = this.p1 & 0xFB | (pressed ? 0 : 0x4);
			break;
		case this.keys.start:
			this.p1 = this.p1 & 0xF7 | (pressed ? 0 : 0x8);
			break;
	}
};

Io.prototype.key = function(key, pressed) {
	if (!(this.p1 & 0x10)) this.keyP14(key, pressed);
	if (!(this.p1 & 0x20)) this.keyP15(key, pressed);
};

Io.prototype.bind = function() {
	var self = this;
	document.addEventListener('keydown', function(e) { self.key(e.keyCode, true); });
	document.addEventListener('keyup', function(e) { self.key(e.keyCode, false); });

};