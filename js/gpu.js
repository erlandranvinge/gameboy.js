
var Display = function(gpu, canvasId) {
	this.gpu = gpu;
	this.canvas = document.getElementById(canvasId);
	if (!this.canvas)
		throw 'Error: Missing canvas element.';
	this.context = this.canvas.getContext('2d');
	this.context.imageSmoothingEnabled = false;
	this.buffer = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
	console.info('Display (%f, %f) attached.', this.canvas.width, this.canvas.height);
};

Display.prototype.scanline = function() {

	var y = this.gpu.ly;
	var destination = this.buffer.data;
	var palette = [255, 200, 128, 40];
	for (var x = 0; x < 160; x++) {

		var tileX = x / 8 | 0;
		var tileY = y / 8 | 0;
		var bit = x - tileX;
		var line = y - tileY;

		var address = 0x8000 + tileY * 512 + tileX * 16;
		var low = this.gpu.vram[address + line * 2];
		var hi = this.gpu.vram[address + line * 2 + 1];
		var mask = 1 << (7 - bit);
		var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
		var color = palette[index];



		var dAddress = (y * 160 + x) * 4;
		destination[dAddress] = color;
		destination[dAddress + 1] = color;
		destination[dAddress + 2] = color;
		destination[dAddress + 3] = 0xFF;
	}

	/*
	var address = 0x8000 + tileY * 512 + tileX * 16;
	var palette = [255, 200, 128, 40];
	for (var line = 0; line < 8; line++) {
		var low = this.gpu.vram[address + line * 2];
		var hi = this.gpu.vram[address + line * 2 + 1];

		for (var bit = 0; bit < 8; bit++)
		{
			var px = tileX * 8 + bit;
			var py = tileY * 8 + line;
			var mask = 1 << (7 - bit);
			var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
			var color = palette[index]; //index == 3 ? 0 : 255;
			var offset = (px + py * 512) * 4;
			this.tiles.data[offset] = color;
			this.tiles.data[offset+1] = color;
			this.tiles.data[offset+2] = color;
		}
	}*/


	/*
	var data = this.buffer.data;
	var offset = this.gpu.ly * 4 * this.canvas.width;
	for (var x = 0; x < this.canvas.width * 4; x+=4) {
		data[offset + x] = 0x0;
		data[offset + x + 1] = 0x0;
		data[offset + x + 2] = 0x0;
		data[offset + x + 3] = 0xFF;
	}*/
};

Display.prototype.blit = function() {
	this.context.putImageData(this.buffer, 0, 0);
	console.log('BLIT!');
};

var GPUMode = { hBlank: 0, vBlank: 1, oamRead: 2, transfer: 3 };

var GPU = function(canvasId) {
	this.display = new Display(this, canvasId);
	this.vram = [];
	this.modeCycle = 0;
	this.mode = 1;
	this.ly = 0x0;
	this.lyc = 0x0;
	this.control = 0x91;
	this.stat = 0x85;
	this.scy = 0;
	this.scx = 0;
};

GPU.prototype.cnt = function() {
	switch(this.mode) {
		case GPUMode.hBlank: return 204 - this.modeCycle;
		case GPUMode.vBlank: return 456 - this.modeCycle;
		case GPUMode.oamRead: return 80 - this.modeCycle;
		case GPUMode.transfer: return 173 - this.modeCycle;
	}
};

GPU.prototype.step = function(cycles) {
	switch(this.mode) {
		case GPUMode.hBlank:
			if (this.modeCycle >= 204) {
				this.modeCycle = -cycles;
				this.ly++;
				if (this.ly == 144) {
					this.mode = GPUMode.vBlank;
					this.cpu.interrupt(Interrupt.vBlank);
					this.display.blit();
				} else {
					this.mode = GPUMode.oamRead;
				}
			}
			break;
		case GPUMode.vBlank:
			if (this.modeCycle >= 456) {
				this.modeCycle = -cycles;
				this.ly++;
				if (this.ly > 153) {
					this.mode = GPUMode.oamRead;
					this.ly = 0;
				}
			}
			break;
		case GPUMode.oamRead:
			if (this.modeCycle >= 80) {
				this.mode = GPUMode.transfer;
				this.modeCycle = -cycles;
			}
			break;
		case GPUMode.transfer: // Transfer
			if (this.modeCycle >= 173) {
				this.mode = GPUMode.hBlank;
				this.modeCycle = -cycles;
				this.display.scanline();
			}
			break;
	}
	this.stat = this.stat & 0xFC | this.mode;
	this.modeCycle += cycles;
};

GPU.prototype.read = function(address) {
	switch(address) {
		case 0xFF40: return this.control;
		case 0xFF44: return this.ly;
		case 0xFF45: return this.lyc;
		default:
			throw 'Error: Invalid GPU read from 0x' + address.toString(16).toUpperCase();
	}
};

GPU.prototype.write = function(address, data) {

	if (address >= 0x8800 && address <= 0x97FF) {
		this.vram[address] = data;
		return;
	}

	if (address >= 0x8000 && address <= 0x8FFF) {
		this.vram[address] = data;
		return;
	}

	if (address >= 0x9800 && address <= 0x9FFF) {
		this.vram[address] = data;
		return;
	}


	switch(address) {
		case 0xFF40:
			console.log('LCD Control:', bits(data, 8));
			this.control = data;
			break;
		case 0xFF41:
			console.log('LCD STAT: ', bits(data, 8));
			this.stat = (this.stat & 0x8F) | (data & 0x70);
			break;
		case 0xFF42: this.scy = data; break;
		case 0xFF43: this.scx = data; break;
		case 0xFF45: this.lyc = data; break;
		default:
			throw 'Error: Invalid GPU write to 0x' + address.toString(16).toUpperCase();
	}
};


/*
var GPU = function() {
	this.cpu = null;
	this.frequency = 4194304; // ~4.194 MHz (vblank @ 59.7 Hz => every 70.251:th cycle )
	this.cycle = 0;
	this.expectedCycle = 0;
	this.control = 0x0;
	this.ly = 0x1;
	this.scx = 0x0;
	this.scy = 0x0;
	this.vram = [];
	for (var address = 0x8000; address < 0xA000; address++)
		this.vram[address] = 0x0;

	this.display = new Display(this);
};

GPU.prototype.tick = function(dt) {
	this.expectedCycle += this.frequency * dt;
	if (this.cycle > this.expectedCycle)
		return;
	if (++this.ly > 153) {
		this.ly = 0;
	}

	if (this.cycle % 70251 === 0) {
		cpu.interrupt(0x0040);
	}
};

GPU.prototype.read = function(address) {
	if (address >= 0x8000 && address < 0xA000) {
		// TODO: Tile stuff.
		return this.vram[address];
	}

	switch(address) {
		case 0xFF40: return this.control; // LCD Control.
		case 0xFF42: return this.scy; // Scroll Y.
		case 0xFF44: return this.ly;  // LCD Y Coordinate.
		default:
			throw 'Error: Invalid GPU read from 0x' + address.toString(16).toUpperCase();
	}
};

GPU.prototype.write = function(address, data) {
	if (address >= 0x8000 && address < 0xA000) {
		this.vram[address] = data;
		var tile = (address - 0x8000) / 16 | 0;
		var tileY = tile / 32 | 0;
		var tileX = tile % 32;
		this.display.updateTile(tileX, tileY);
		return;
	}

	switch(address) {
		case 0xFF40:
			console.log('LCD: Control');
			console.log(bits(data, 8));

			break;
		case 0xFF41:
			console.log('LCD: Status');
			console.log(bits(data, 8));
			break; // LCD status.
		case 0xFF42: this.scy = data; break; // Set ScrollY coordinate.
		case 0xFF43: this.scx = data; break; // Set ScrollX coordinate.
		case 0xFF45: break; // LY Compare.
		case 0xFF47: break; // Background palette.
		default:
			throw 'Error: Invalid GPU write to 0x' + address.toString(16).toUpperCase();
	}
};

var Display = function(gpu) {
	this.gpu = gpu;
	this.vram = [];
	this.canvas = document.getElementsByTagName('canvas')[0];
	if (!this.canvas)
		throw 'Error: Missing canvas element.';
	this.context = this.canvas.getContext('2d');
	this.context.imageSmoothingEnabled = false;
	this.buffer = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

	this.tiles = this.context.createImageData(512, 512);
	for (var i = 0; i < this.tiles.data.length; i+=4) {
		this.tiles.data[i] = 0x0;
		this.tiles.data[i+1] = 0x0;
		this.tiles.data[i+2] = 0x0;
		this.tiles.data[i+3] = 0xFF;
	}
};

Display.prototype.blit = function() {
	this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	for (var tileY = 0; tileY < 32; tileY++) {
		for (var tileX = 0; tileX < 32; tileX++) {
			var tile = this.gpu.vram[0x9800 + tileY * 32 + tileX];
			//if (tile === 0) continue; // For now, probably not true.
			var sx = (tile % 32) * 8;
			var sy = (tile / 32 | 0) * 8;
			this.context.putImageData(this.tiles,
				tileX * 8 - sx,
				tileY * 8 - sy - this.gpu.scy,
				sx, sy, 8, 8);
		}
	}
};

Display.prototype.updateTile = function(tileX, tileY) {
	var address = 0x8000 + tileY * 512 + tileX * 16;
	var palette = [255, 200, 128, 40];
	for (var line = 0; line < 8; line++) {
		var low = this.gpu.vram[address + line * 2];
		var hi = this.gpu.vram[address + line * 2 + 1];

		for (var bit = 0; bit < 8; bit++)
		{
			var px = tileX * 8 + bit;
			var py = tileY * 8 + line;
			var mask = 1 << (7 - bit);
			var index = (low & mask ? 1 : 0) + (hi & mask ? 2 : 0);
			var color = palette[index]; //index == 3 ? 0 : 255;
			var offset = (px + py * 512) * 4;
			this.tiles.data[offset] = color;
			this.tiles.data[offset+1] = color;
			this.tiles.data[offset+2] = color;
		}
	}
};

Display.prototype.drawTiles = function() {
	this.context.putImageData(this.tiles, 0, 0);
//	this.context.putImageData(this.tiles, 0, 0, 512, 512);
};

*/