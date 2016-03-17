#!/usr/bin/env node

(function () {
	"use strict";

	const path = require('path');

	const spawn = require('child_process').spawn;

	const scanServer = require('scanserver');

	const utils = require('utils');

	const server = new scanServer.Server(__dirname, 80);

	const fs = require('fs');

	function saveData (data) {
		const self = this;
		fs.open(path.join(__dirname, 'data.json'), 'w', (err, fd) => {
			if (err) {
				self.emit('error', 503, 'Can not save new changes');
			} else {
				fs.write(fd, JSON.stringify(data), 0, 'utf8', (err, written, string) => {
					if (err) {
						self.emit('error', 503, 'Can not save new changes');
					} else {
						fs.close(fd, (err) => {
							if (err)
								self.emit('error', 520);
							else
								self.emit('dataComplete', 'Ok');
						});
					}
				});
			}
		});
	}

	function performCmd (cmd, values) {
		function _getIndex(obj) {
			var index = 0;
			for (var key in obj) {
				i = parseInt(obj[key].index);
				if (i >= index)
					index = i++;
			}
			return index;
		}

		let data = require(path.join(__dirname, 'data.json'));
		switch (cmd) {
			case 'data':
				this.emit('dataComplete', data);
				break;
			case 'delete':
				if (values.number)
					delete data[values.name][values.number];
				else
					delete data[values.name];
				saveData.call(this, data);
				break;
			case 'add':
				let name = values.name;
				if (!data[name])
					data[name] = {};
				if (values.number) {
					if (!data[name][values.number])
						data[name][values.number] = {
						};
					data[name][values.number].description = values.description || '';
					if ('index' in values)
						data[name][values.number].index = values.index;
					else if (! 'index' in data[name][values.number]) 
						data[name][values.number].index = _getIndex(data[name])
				}
				saveData.call(this, data);
				break;
			default: this.emit('error', 405, 'Unknown command: ' + cmd);

		}
	}

	server.jobs.on('data', function (type, data) {

		if (!/\bapplication\/json\b/.test(type))
			this.sendError(400, 'The content-type must be an "application/json".');
		data = JSON.parse(data);


		if (!(data instanceof Array))
			this.sendError(400, 'Content must be an Array.');

		let common = {};
		this.cmds = [];
		for (let i = 0, j = 1, l = data.length; i < l; ++i, ++j) {
			let di = data[i], dj = data[j];
			switch (typeof di) {
				case 'object': common = di; continue; break;
				case 'string': this.cmds.push([di, typeof dj === 'object' ? utils.joiny(dj, common) : common]); break;
				default: this.sendError(400, 'The type of content elements must be a string or an object');
			}
		}
		if (this.cmds.length)
				performCmd.apply(this, this.cmds.shift());
	});

	server.jobs.on('dataComplete', function (data) {
		if (!this.answers)
			this.answers = [data];
		else
			this.answers.push(data);

		if (this.cmds.length) {
			performCmd.apply(this, this.cmds.shift());
		} else {
			this.sendData(JSON.stringify(this.answers), 'json');
		}
	});

	server.jobs.on('error', function (code, msg) {
		this.sendError(code, msg);
	});

	server.up();
})()