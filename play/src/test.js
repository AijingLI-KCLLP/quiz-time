//hoisting 这个神秘的


(function() {
    console.log(foo);
    var foo = 2;
})(); // undefined
// la déclaration var foo est remontée en haut de la fonction SANS son initialisation. foo existe donc mais vaut undefined au moment du log (slide 10-11 du cours).

//« Javascript remonte automatiquement les déclarations de variables sans les initialiser en haut du scope courant pour le keyword var ». let/const sont hissés mais inaccessibles avant leur déclaration (TDZ, MDN).

