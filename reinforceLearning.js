var R = {};

(function(global) {
  "use strict";

  function assert(condition, message) {
    if (!condition) {
      message = message || "Assertion failed";
      if (typeof Error !== "undefined") {
        throw new Error(message);
      }
      throw message; // Fallback
    }
  }

  var return_v = false;
  var v_val = 0.0;
  var gaussRandom = function() {
    if(return_v) {
      return_v = false;
      return v_val;
    }
    var u = 2*Math.random()-1;
    var v = 2*Math.random()-1;
    var r = u*u + v*v;
    if(r == 0 || r > 1) return gaussRandom();
    var c = Math.sqrt(-2*Math.log(r)/r);
    v_val = v*c; // cache this
    return_v = true;
    return u*c;
  }

  var randf = function(a, b) { return Math.random()*(b-a)+a; }
  var randi = function(a, b) { return Math.floor(Math.random()*(b-a)+a); }
  var randn = function(mu, std){ return mu+gaussRandom()*std; }

  var zeros = function(n) {
    if(typeof(n)==='undefined' || isNaN(n)) { return []; }
    if(typeof ArrayBuffer === 'undefined') {
      var arr = new Array(n);

      for(var i=0;i<n;i++) { arr[i] = 0; }
      return arr;
    } else {
      return new Float64Array(n);
    }
  }

  var Mat = function(n,d) {
    this.n = n;
    this.d = d;
  }
  Mat.prototype = {
    get: function(row, col) {
      var ix = (this.d * row) + col;
      assert(ix >= 0 && ix < this.w.length);
      return this.w[ix];
    },
    set: function(row, col, v) {
      var ix = (this.d * row) + col;
      assert(ix >= 0 && ix < this.w.length);
      this.w[ix] = v;
    }
  }

  var updateMat = function(m, alpha) {
    for(var i=0,n=m.n*m.d;i<n;i++) {
      if(m.dw[i] !== 0) {
        m.w[i] += - alpha * m.dw[i];
        m.dw[i] = 0;
      }
    }
  }

  var updateNet = function(net, alpha) {
    for(var p in net) {
      if(net.hasOwnProperty(p)){
        updateMat(net[p], alpha);
      }
    }
  }

  var RandMat = function(n,d,mu,std) {
    var m = new Mat(n, d);
    fillRandn(m,mu,std);
    return m;
  }

  var fillRandn = function(m, mu, std) {
    for(var i=0,n=m.w.length;i<n;i++) {
      m.w[i] = randn(mu, std);
    }
  }

  var Graph = function(needs_backprop) {
    if(typeof needs_backprop === 'undefined') { needs_backprop = true; }
    this.needs_backprop = needs_backprop;

    this.backprop = [];
  }
  Graph.prototype = {
    add: function(m1, m2) {
      assert(m1.w.length === m2.w.length);

      var out = new Mat(m1.n, m1.d);
      for(var i=0,n=m1.w.length;i<n;i++) {
        out.w[i] = m1.w[i] + m2.w[i];
      }
      if(this.needs_backprop) {
        var backward = function() {
          for(var i=0,n=m1.w.length;i<n;i++) {
            m1.dw[i] += out.dw[i];
            m2.dw[i] += out.dw[i];
          }
        }
        this.backprop.push(backward);
      }
      return out;
    },
  }


  var maxi = function(w) {
    var maxv = w[0];
    var maxix = 0;
    for(var i=1,n=w.length;i<n;i++) {
      var v = w[i];
      if(v > maxv) {
        maxix = i;
        maxv = v;
      }
    }
    return maxix;
  }

  var samplei = function(w) {
    var r = randf(0,1);
    var x = 0.0;
    var i = 0;
    while(true) {
      x += w[i];
      if(x > r) { return i; }
      i++;
    }
    return w.length - 1;
  }

  global.assert = assert;
  global.zeros = zeros;
  global.maxi = maxi;
  global.samplei = samplei;
  global.randi = randi;
  global.randn = randn;
  global.Mat = Mat;
  global.RandMat = RandMat;

  global.updateMat = updateMat;
  global.updateNet = updateNet;
  global.Graph = Graph;
})(R);

var RL = {};
(function(global) {
  "use strict";

var getopt = function(opt, field_name, default_value) {
  if(typeof opt === 'undefined') { return default_value; }
  return (typeof opt[field_name] !== 'undefined') ? opt[field_name] : default_value;
}

var zeros = R.zeros;
var assert = R.assert;

var sampleWeighted = function(p) {
  var r = Math.random();
  var c = 0.0;
  for(var i=0,n=p.length;i<n;i++) {
    c += p[i];
    if(c >= r) { return i; }
  }
  assert(false, 'wtf');
}

// ------
// AGENT
// ------

var DPAgent = function(env, opt) {
  this.V = null;
  this.P = null;
  this.env = env;
  this.gamma = getopt(opt, 'gamma', 1);
  this.reset();
}

DPAgent.prototype = {
  reset: function() {
    this.ns = this.env.getNumStates();
    this.na = this.env.getMaxNumActions();
    this.V = zeros(this.ns);
    this.P = zeros(this.ns * this.na);

    for(var s=0;s<this.ns;s++) {
      var poss = this.env.allowedActions(s);
      for(var i=0,n=poss.length;i<n;i++) {
        this.P[poss[i]*this.ns+s] = 1.0 / poss.length;
      }
    }
  },
  act: function(s) {
    var poss = this.env.allowedActions(s);
    var ps = [];

    for(var i=0,n=poss.length;i<n;i++) {
      var a = poss[i];
      var prob = this.P[a*this.ns+s];
      ps.push(prob);
    }
    var maxi = sampleWeighted(ps);
    return poss[maxi];
  },
  learn: function() {
    this.evaluatePolicy();
    this.updatePolicy();
  },
  evaluatePolicy: function() {
    var Vnew = zeros(this.ns);
    for(var s=0;s<this.ns;s++) {
      var v = 0.0;
      var poss = this.env.allowedActions(s);
      for(var i=0,n=poss.length;i<n;i++) {
        var a = poss[i];
        var prob = this.P[a*this.ns+s];
        if(prob === 0) { continue; }
        var ns = this.env.nextStateDistribution(s,a);
        var rs = this.env.reward(s,a,ns);
        v += prob * (rs + this.gamma * this.V[ns]);
      }
      Vnew[s] = v;
    }
    this.V = Vnew;
  },
  updatePolicy: function() {
    for(var s=0;s<this.ns;s++) {
      var poss = this.env.allowedActions(s);
      var vmax, nmax;
      var vs = [];

      for(var i=0,n=poss.length;i<n;i++) {
        var a = poss[i];
        var ns = this.env.nextStateDistribution(s,a);
        var rs = this.env.reward(s,a,ns);
        var v = rs + this.gamma * this.V[ns];
        vs.push(v);
        if(i === 0 || v > vmax) { vmax = v; nmax = 1; }
        else if(v === vmax) { nmax += 1; }
      }

      for(var i=0,n=poss.length;i<n;i++) {
        var a = poss[i];
        this.P[a*this.ns+s] = (vs[i] === vmax) ? 1.0/nmax : 0.0;
      }
    }
  },
}

global.DPAgent = DPAgent;
})(RL);