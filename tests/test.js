
var CRC = function() {
	var c;
	this.table = [];
	for(var n = 0; n < 256; n++) {
		c = n;
		for(var k =0; k < 8; k++) {
			c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
		}
		this.table[n] = c;
	}
	this.crc = 0 ^ (-1);
};

CRC.prototype.calculate = function(value) {
	var crc = 0 ^ (-1);
	this.crc = (this.crc >>> 8) ^ this.table[(crc ^ value) & 0xFF];
	return (crc ^ (-1)) >>> 0;
};


