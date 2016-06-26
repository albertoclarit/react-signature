(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ReactSignature = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var React = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);
var Point = require("./points_util.js");
var Bezier = require("./bezier_util.js");

var PropTypes = React.PropTypes;

var velocityFilterWeight = 0.7;
var minWidth = 0.5;
var maxWidth = 2.5;
var dotSize = 1.5;
var penColor = "black";
var backgroundColor = "rgba(0,0,0,0)";
var canvas;
var context;
var mouseButtonDown = false;

var ReactSignature = React.createClass({
  displayName: "ReactSignature",

  getDefaultProps: function getDefaultProps() {
    return {
      width: 450,
      height: 300
    };
  },
  getInitialState: function getInitialState() {
    return {
      edited: false
    };
  },
  componentDidMount: function componentDidMount() {
    canvas = this.refs.canvas;
    context = canvas.getContext('2d');
  },

  removeBlanks: function removeBlanks() {
    var imgWidth = context.canvas.width;
    var imgHeight = context.canvas.height;
    var imageData = context.getImageData(0, 0, imgWidth, imgHeight),
        data = imageData.data,
        getAlpha = function getAlpha(x, y) {
      return data[(imgWidth * y + x) * 4 + 3];
    },
        scanY = function scanY(fromTop) {
      var offset = fromTop ? 1 : -1;

      // loop through each row
      for (var y = fromTop ? 0 : imgHeight - 1; fromTop ? y < imgHeight : y > -1; y += offset) {

        // loop through each column
        for (var x = 0; x < imgWidth; x++) {
          if (getAlpha(x, y)) {
            return y;
          }
        }
      }
      return null; // all image is white
    },
        scanX = function scanX(fromLeft) {
      var offset = fromLeft ? 1 : -1;

      // loop through each column
      for (var x = fromLeft ? 0 : imgWidth - 1; fromLeft ? x < imgWidth : x > -1; x += offset) {

        // loop through each row
        for (var y = 0; y < imgHeight; y++) {
          if (getAlpha(x, y)) {
            return x;
          }
        }
      }
      return null; // all image is white
    };

    var cropTop = scanY(true),
        cropBottom = scanY(false),
        cropLeft = scanX(true),
        cropRight = scanX(false);

    var relevantData = context.getImageData(cropLeft, cropTop, cropRight - cropLeft, cropBottom - cropTop);
    canvas.width = cropRight - cropLeft;
    canvas.height = cropBottom - cropTop;
    context.clearRect(0, 0, cropRight - cropLeft, cropBottom - cropTop);
    context.putImageData(relevantData, 0, 0);
  },
  handleClear: function handleClear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    this.reset();
  },
  isEdited: function isEdited() {

    return this.state.edited ? true : false;
  },

  toDataURL: function toDataURL() {
    return canvas.toDataURL.apply(canvas, arguments);
  },

  fromDataURL: function fromDataURL(dataURL) {
    var image = new Image(),
        ratio = window.devicePixelRatio || 1,
        width = canvas.width / ratio,
        height = canvas.height / ratio;
    this.reset();
    image.src = dataURL;
    image.onload = function () {
      context.drawImage(image, 0, 0, width, height);
    };
    this.isEmpty = false;
  },

  handleMouseDown: function handleMouseDown(e) {
    mouseButtonDown = true;
    this.strokeBegin(e);
    this.setState({
      edited: true
    });
  },

  handleMouseMove: function handleMouseMove(e) {
    if (mouseButtonDown) {
      this.strokeUpdate(e);
    }
  },

  handleMouseUp: function handleMouseUp(e) {
    mouseButtonDown = false;

    this.strokeEnd(e);
  },

  strokeUpdate: function strokeUpdate(e) {
    var point = this.createPoint(e);
    this.addPoint(point);
  },

  strokeBegin: function strokeBegin(e) {
    this.reset();
    this.strokeUpdate(e);
  },

  strokeDraw: function strokeDraw(point) {
    context.beginPath();
    this.drawPoint(point.x, point.y, dotSize);
    context.closePath();
    context.fill();
  },

  strokeEnd: function strokeEnd(e) {
    var canDrawCurve = this.points.length > 2,
        point = this.points[0];

    if (!canDrawCurve && point) {
      this.strokeDraw(point);
    }
  },

  createPoint: function createPoint(e) {
    var rect = canvas.getBoundingClientRect();
    return new Point(e.clientX - rect.left, e.clientY - rect.top);
  },

  addPoint: function addPoint(point) {
    var c2, c3, curve, tmp;
    this.points.push(point);

    if (this.points.length > 2) {
      // To reduce the initial lag make it work with 3 points
      // by copying the first point to the beginning.
      if (this.points.length === 3) this.points.unshift(this.points[0]);

      tmp = this.calculateCurveControlPoints(this.points[0], this.points[1], this.points[2]);

      c2 = tmp.c2;
      tmp = this.calculateCurveControlPoints(this.points[1], this.points[2], this.points[3]);
      c3 = tmp.c1;
      curve = new Bezier(this.points[1], c2, c3, this.points[2]);
      this.addCurve(curve);

      // Remove the first element from the list,
      // so that we always have no more than 4 points in points array.
      this.points.shift();
    }
  },

  addCurve: function addCurve(curve) {
    var startPoint = curve.startPoint,
        endPoint = curve.endPoint,
        velocity,
        newWidth;
    velocity = endPoint.velocityFrom(startPoint);
    velocity = velocityFilterWeight * velocity + (1 - velocityFilterWeight) * this.lastVelocity;

    newWidth = this.strokeWidth(velocity);
    this.drawCurve(curve, this.lastWidth, newWidth);

    this.lastVelocity = velocity;
    this.lastWidth = newWidth;
  },

  calculateCurveControlPoints: function calculateCurveControlPoints(s1, s2, s3) {
    var dx1 = s1.x - s2.x,
        dy1 = s1.y - s2.y,
        dx2 = s2.x - s3.x,
        dy2 = s2.y - s3.y,
        m1 = { x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0 },
        m2 = { x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0 },
        l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1),
        l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2),
        dxm = m1.x - m2.x,
        dym = m1.y - m2.y,
        k = l2 / (l1 + l2),
        cm = { x: m2.x + dxm * k, y: m2.y + dym * k },
        tx = s2.x - cm.x,
        ty = s2.y - cm.y;

    return {
      c1: new Point(m1.x + tx, m1.y + ty),
      c2: new Point(m2.x + tx, m2.y + ty)
    };
  },
  isEmpty: function isEmpty() {
    return this.isEmpty;
  },
  reset: function reset() {
    this.points = [];
    this.lastVelocity = 0;
    this.lastWidth = (this.minWidth + this.maxWidth) / 2;
    this.isEmpty = true;
    context.fillStyle = penColor;
    this.setState({
      edited: false
    });
  },
  drawPoint: function drawPoint(x, y, size) {
    context.moveTo(x, y);
    context.arc(x, y, size, 0, 2 * Math.PI, false);
    this.isEmpty = false;
  },
  drawCurve: function drawCurve(curve, startWidth, endWidth) {
    var widthDelta = endWidth - startWidth,
        drawSteps,
        width,
        i,
        t,
        tt,
        ttt,
        u,
        uu,
        uuu,
        x,
        y;

    drawSteps = Math.floor(curve.length());
    context.beginPath();
    for (i = 0; i < drawSteps; i++) {
      t = i / drawSteps;
      tt = t * t;
      ttt = tt * t;
      u = 1 - t;
      uu = u * u;
      uuu = uu * u;

      x = uuu * curve.startPoint.x;
      x += 3 * uu * t * curve.control1.x;
      x += 3 * u * tt * curve.control2.x;
      x += ttt * curve.endPoint.x;

      y = uuu * curve.startPoint.y;
      y += 3 * uu * t * curve.control1.y;
      y += 3 * u * tt * curve.control2.y;
      y += ttt * curve.endPoint.y;

      width = startWidth + ttt * widthDelta;
      this.drawPoint(x, y, width);
    }
    context.closePath();
    context.fill();
  },
  strokeWidth: function strokeWidth(velocity) {
    return Math.max(maxWidth / (velocity + 1), minWidth);
  },
  render: function render() {
    return React.createElement("canvas", { width: this.props.width, height: this.props.height, ref: "canvas", onMouseDown: this.handleMouseDown, onMouseMove: this.handleMouseMove, onMouseUp: this.handleMouseUp });
  }

});

exports["default"] = ReactSignature;
module.exports = exports["default"];

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./bezier_util.js":2,"./points_util.js":3}],2:[function(require,module,exports){
"use strict";

var Bezier = function Bezier(startPoint, control1, control2, endPoint) {
  this.startPoint = startPoint;
  this.control1 = control1;
  this.control2 = control2;
  this.endPoint = endPoint;
};

Bezier.prototype.length = function () {
  var steps = 10,
      length = 0,
      i,
      t,
      cx,
      cy,
      px,
      py,
      xdiff,
      ydiff;

  for (i = 0; i <= steps; i++) {
    t = i / steps;
    cx = this.point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
    cy = this.point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);
    if (i > 0) {
      xdiff = cx - px;
      ydiff = cy - py;
      length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
    }
    px = cx;
    py = cy;
  }
  return length;
};

Bezier.prototype.point = function (t, start, c1, c2, end) {
  return start * (1.0 - t) * (1.0 - t) * (1.0 - t) + 3.0 * c1 * (1.0 - t) * (1.0 - t) * t + 3.0 * c2 * (1.0 - t) * t * t + end * t * t * t;
};

module.exports = Bezier;

},{}],3:[function(require,module,exports){
"use strict";

var Point = function Point(x, y, time) {
  this.x = x;
  this.y = y;
  this.time = time || new Date().getTime();
};

Point.prototype.velocityFrom = function (start) {
  return this.time !== start.time ? this.distanceTo(start) / (this.time - start.time) : 1;
};

Point.prototype.distanceTo = function (start) {
  return Math.sqrt(Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2));
};

module.exports = Point;

},{}]},{},[1])(1)
});