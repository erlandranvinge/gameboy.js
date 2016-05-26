
var SPU = function() {
	this.frequency = 512; // Sound unit runs on 512 Hz
	this.cycle = 0;
	this.expectedCycle = 0;
	this.context = new AudioContext();
	this.sound1 = new Sound(this);
	this.log = false;
};

SPU.prototype.tick = function(dt) {
	this.expectedCycle += this.frequency * dt;
	if (this.cycle > this.expectedCycle)
		return;

	var subCycle = this.cycle & 0x7;
	if (!(subCycle & 0x1)) { // Length
		this.sound1.tick(1);
	}
	if (subCycle === 2 || subCycle === 6) {} // Sweep
	if (subCycle === 7) {} // Volume.

	this.cycle++;
};

SPU.prototype.read = function(address) {
	switch(address) {
		default:
			throw 'Unknown SPU read from 0x' + address.toString(16).toUpperCase();
	}
};

SPU.prototype.write = function(address, data) {
	switch(address) {
		case 0xFF10: // Sound1 sweep.
			if (this.log) console.log('SPU S1: Sweep.');
			break;
		case 0xFF11: // Sound1 length/wave patterns.
			this.sound1.length = data; //(64 - (data & 0x3F)) * 0.00390625;
			if (this.log) console.log('SPU S1: Length/wave patterns.');
			break;
		case 0xFF12: // Sound1 envelope.
			if (this.log) console.log('SPU S1: Envelope.');
			break;
		case 0xFF13: // Sound1 lo frequency.
			this.sound1.frequency = (this.sound1.frequency & 0xFF00) | (data & 0xFF);
			if (this.log) console.log('SPU S1: Low-frequency.');
			break;
		case 0xFF14: // Sound1 hi frequency.
			this.sound1.frequency = (this.sound1.frequency & 0xFF) | (data << 8 & 0x700);
			if (this.log) console.log('SPU S1: Hi-frequency.');
			this.sound1.start();
			break;
		case 0xFF17: // Sound2 envelope.
			if (this.log) console.log('SPU S2: Envelope.');
			break;
		case 0xFF19: // Sound4 frequency hi.
			if (this.log) console.log('SPU S4: Hi-frequency.')
			break;
		case 0xFF1A: // Sound3 on/off.
			if (this.log) console.log('SPU S3: On/off.')
			break;
		case 0xFF21: // Sound4 envelope.
			if (this.log) console.log('SPU S4: Envelope.');
			break;
		case 0xFF23: // Sound4 counter.
			if (this.log) console.log('SPU S4: Counter.');
			break;
		case 0xFF24: // Volume control.
			if (this.log) console.log('SPU: Sound volume & channel control.');
			break;
		case 0xFF25: // Selection of Sound output terminal.
			if (this.log) console.log('SPU: Selection of terminal: 0x' + data.toString(16).toUpperCase());
			break;
		case 0xFF26:
			if (this.log) console.log('SPU: Sound on/off: 0x' + data.toString(16).toUpperCase());
			break;
		default:
			throw 'Error: Unknown SPU write to 0x' + address.toString(16).toUpperCase();
	}
};

var Sound = function(spu) {
	this.spu = spu;
	this.node = null;
	this.frequency = 0;
	this.length = 0;
	this._length = 0;
};

Sound.prototype.start = function() {
	this.stop();
	this._length = this.length;
	this.node = this.spu.context.createOscillator();
	this.node.type = 'square';
	this.node.frequency.value = 131072 / (2048 - this.frequency);
	this.node.connect(this.spu.context.destination);
	//this.node.start();
};

Sound.prototype.stop = function() {
	if (!this.node) return;
	//this.node.stop();
	this.node = null;
};

Sound.prototype.tick = function(type) {
	if (type === 1 && this._length > 0) {
		this._length--;
		if (this._length <= 0) {
			this._length = 0;
			this.stop();
		}
	}
};






