var gv_epoch = 0;
var canvas = $('#GameBoardCanvas');

//Tableau de jeu 1 = mur, 0 = chemin possible, -1 = fin du Labyrinthe
var board = [
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [ 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    [ 0, 0, 0, 0, 1, 1, 1, 0, 1, 0],
    [ 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
    [ 0, 0, 1, 1, 1, 1, 1, 0, 1, 0],
    [ 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    [ 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [ 1, 0, 1, 0, 1, 0, 0, 1, 1, 0],
    [-1, 0, 1, 0, 1, 1, 0, 0, 0, 0]
];

var player = {
    x: 0,
    y: 0
};

//Dessine le tableau
function draw(){
    var width = canvas.width();
    var height = canvas.height();
    var blockSize = width/board.length;
    var gameBoard = canvas[0].getContext('2d');
    gameBoard.setTransform(1, 0, 0, 1, 0, 0);
    gameBoard.clearRect(0, 0, width, height);
    gameBoard.fillStyle="black";

    gameBoard.font = '42pt Arial';
    gameBoard.fillText("Learning Cycle : " + gv_epoch , 10, 700);

    gameBoard.strokeStyle = "black";
    gameBoard.strokeRect(0, 0, 600, 605);

    //Loop through the board array drawing the walls and the goal
    for(var y = 0; y < board.length; y++){
        for(var x = 0; x < board[y].length; x++){
            //Draw a wall
            if(board[y][x] === 1){
                gameBoard.fillRect(x*blockSize, y*blockSize, blockSize, blockSize);
            }
            //Draw the goal
            else if(board[y][x] === -1){
                gameBoard.beginPath();
                gameBoard.lineWidth = 5;
                gameBoard.strokeStyle = "gold";
                gameBoard.moveTo(x*blockSize, y*blockSize);
                gameBoard.lineTo((x+1)*blockSize, (y+1)*blockSize);
                gameBoard.moveTo(x*blockSize, (y+1)*blockSize);
                gameBoard.lineTo((x+1)*blockSize, y*blockSize);
                gameBoard.stroke();
            }
        }
    }
    //Draw the player
    gameBoard.beginPath();
    var half = blockSize/2;
    gameBoard.fillStyle = "green";
    gameBoard.arc(player.x*blockSize+half, player.y*blockSize+half, half/2, 0, 2*Math.PI);
    gameBoard.fill();
}

//Check to see if the new space is inside the board and not a wall
function canMove(x, y){
    return (y>=0) && (y<board.length) && (x >= 0) && (x < board[y].length) && (board[y][x] != 1);
}

//On commente c'est pour diriger l'agent
/*$(document).keyup(function(e){
    if((e.which == 38) && canMove(player.x, player.y-1))//Up arrow
        player.y--;
    else if((e.which == 40) && canMove(player.x, player.y+1)) // down arrow
        player.y++;
    else if((e.which == 37) && canMove(player.x-1, player.y))
        player.x--;
    else if((e.which == 39) && canMove(player.x+1, player.y))
        player.x++;
    draw();
    e.preventDefault();
});*/

draw();

var Matrix = function(){
    this.RewardList = null; // reward array
    this.PathList = null; // cell types, 0 = normal, 1 = cliff
    this.gs = null;
    this.gameBoardHeight = null;
    this.reset()
}

Matrix.prototype = {
    reset: function(){
        this.RewardList = [
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ];
        this.PathList =  [
            [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [ 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
            [ 0, 0, 0, 0, 1, 1, 1, 0, 1, 0],
            [ 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
            [ 0, 0, 1, 1, 1, 1, 1, 0, 1, 0],
            [ 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
            [ 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
            [ 1, 0, 1, 0, 1, 0, 0, 1, 1, 0],
            [ 0, 0, 1, 0, 1, 1, 0, 0, 0, 0]
        ];
        this.gs = 100;
        this.gameBoardHeight = 10;
        player = {
            x: 0,
            y: 0
        };
    },
    getNumStates: function(){
        return this.gs;
    },
    getMaxNumActions: function(){
        return 4;
    },
    allowedActions: function(s){
        var x = this.stox(s);
        var y = this.stoy(s);
        var allowedStates = [];
        if(!(this.PathList[y][x] === 1)){
            if(canMove(x-1, y)) { allowedStates.push(0); }
            if(canMove(x, y-1)) { allowedStates.push(1); }
            if(canMove(x, y+1)) { allowedStates.push(2); }
            if(canMove(x+1, y)) { allowedStates.push(3); }
        }

        return allowedStates;
    },

    nextStateDistribution: function(s,a){

        if(s === 9) {
            // agent wins! teleport to start
            return 9;
        } else {
            // ordinary space
            var nx, ny;
            var x = this.stox(s);
            var y = this.stoy(s);
            if(a === 0) {nx=x-1; ny=y;}
            if(a === 1) {nx=x; ny=y-1;}
            if(a === 2) {nx=x; ny=y+1;}
            if(a === 3) {nx=x+1; ny=y;}
            var nextState = nx*this.gameBoardHeight+ny;
            if(this.PathList[ny][nx] === 1) {
                // actually never mind, this is a wall. reset the agent
                var nextState = s;
            }
        }
        return nextState;

    },
    reward: function(s,a,nextState) {
        var lx =  this.stox(s);
        var ly =  this.stoy(s);

        return this.RewardList[ly][lx];
    },
    stox: function(s) { return Math.floor(s/this.gameBoardHeight); },
    stoy: function(s) { return s % this.gameBoardHeight; },
}

// create environment
env = new Matrix();
// create the agent, yay! Discount factor 0.9
agent = new RL.DPAgent(env, {'gamma':0.9});

// call this function repeatedly until convergence:

for(i=0;i<20;i++){
    gv_epoch++;
    agent.learn();
}

var lv_state = 0;
var lv_nextState,lv_timer;

playMaze();
ResetGame();

//Increase Epoch by Right Arrow.
$(document).keyup(function(e){
    if((e.which == 39))//right arrow
        gv_epoch++;
    agent.learn();
    player = {
        x: 0,
        y: 0
    };
    lv_state = 0;
    e.preventDefault();
});

function playMaze(){
    play();
    lv_timer = setTimeout(playMaze,200);
}

function ResetGame(){
    if(lv_state === 9 && gv_epoch < 100){
        gv_epoch++;
        player = {
            x: 0,
            y: 0
        };
        lv_state = 0;
    }
    setTimeout(ResetGame,2000);
}

function play(){
    if(!(lv_state === 9)){

        var action = agent.act(lv_state);
        lv_nextState = nextState(lv_state,action);

        if(lv_state === 9) {
            // agent wins! teleport to start
            agent.learn();
            lv_nextState = 9;

        } else {
            // ordinary space
            var nx, ny;
            var x = Math.floor(lv_state/10);
            var y = lv_state % 10;
            if(action === 0) {nx=x-1; ny=y;}
            if(action === 1) {nx=x; ny=y-1;}
            if(action === 2) {nx=x; ny=y+1;}
            if(action === 3) {nx=x+1; ny=y;}
            lv_nextState = nx*10+ny;
            if(board[ny][nx] === 1) {
                // actually never mind, this is a wall. reset the agent
                lv_nextState = s;
            }
        }

        lv_state = lv_nextState;
        if(action === 0){
            player.x--;
            draw();
        }
        if(action === 1){
            player.y--;
            draw();
        }
        if(action === 2){
            player.y++;
            draw();
        }
        if(action === 3){
            player.x++;
            draw();
        }
    }
}

function nextState(s,a){
    if(s === 9) {
        // agent wins! teleport to start
        agent.learn();
        return 9;
    } else {
        // ordinary space
        var nx, ny;
        var x = Math.floor(s/10);
        var y = s % 10;
        if(a === 0) {nx=x-1; ny=y;}
        if(a === 1) {nx=x; ny=y-1;}
        if(a === 2) {nx=x; ny=y+1;}
        if(a === 3) {nx=x+1; ny=y;}
        var nextState = nx*10+ny;

    }
    return nextState;
}