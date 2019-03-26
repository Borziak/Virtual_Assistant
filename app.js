jQuery(document).ready(function($){
    $('#widget_button').draggable({
        containment: 'window'
    });
    $('#widget_body').draggable({
        handle: '#widget_header',
        containment: 'window'
    });

    const S_CHANNEL = {
        INIT_USER: 'init-user',
        INIT_BOT: 'init-bot',
        INIT_HISTORY: 'init-history',
        MESSAGE: 'message',
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        EXCEPTION: 'exception',
        CLEAR_USER_DATA: 'clear-user-data',
        WELCOME_EVENT_FIRST: 'welcome-event-first',
        WELCOME_EVENT_RETURN: 'welcome-event-return'
    };
    const INIT_STATUS = {
        INITIALIZED: 'initialized',
        NON_INITIALIZED: 'non-initialized',
        RESET: 'reset'
    };
    const lStorage = {
        get: function(key) {
            return JSON.parse(localStorage.getItem(key));
        },
        keys: {
            INT_USER: 'intUser',
            INIT_STATUS: 'init-status'

        },
        set: function(key, item) {
            localStorage.setItem(key, JSON.stringify(item));
        },
        remove: function(key) {
            localStorage.removeItem(key);
        },
        clear: function() {
            localStorage.clear();
        },
        has: function(key) {
            return localStorage.getItem(key) !== null;
        }

    };
    let chat = {
        socket: {},
        opened: false,
        active: false,
        guestName: 'dear Guest',
        firstTime: true,
        APIkey: '563492ad6f91700001000001bb151c8c07f048768f0c409fc846429b',
        messageQueue: 0,
        lastMessage: '',
        currentLocation: location.href,
        connect: function () {
            console.log('Connected');
            socket.emit(S_CHANNEL.INIT_BOT, { id: 16 });
            if (lStorage.has(lStorage.keys.INT_USER) && lStorage.get(lStorage.keys.INIT_STATUS) === INIT_STATUS.INITIALIZED) {
                //return history for existing user
                const user = lStorage.get(lStorage.keys.INT_USER);
                chat.user = user;
                socket.emit(S_CHANNEL.INIT_HISTORY, user);
            } else {
                socket.emit(S_CHANNEL.INIT_USER, { name: 'Guest' });
            }

        },
        initBot: function (data) {
            bot = data;
            console.log(`get init-bot response with: ${JSON.stringify(data)}`);
        },
        initUser: function (data) {
            chat.user = data;
            lStorage.set(lStorage.keys.INT_USER, data);
            console.log(`get init-user response with: ${JSON.stringify(data)}`);
            if (lStorage.get(lStorage.keys.INIT_STATUS) !== INIT_STATUS.RESET) {
                socket.emit(S_CHANNEL.WELCOME_EVENT_FIRST, chat.user);
            }
            lStorage.set(lStorage.keys.INIT_STATUS, INIT_STATUS.INITIALIZED);

        },
        chatMessage: function (data) {
            console.log(`get message response with: ${JSON.stringify(data)}`);
            data.forEach(d => chat.addMessage(d, 'bot'));
        },
        initHistory: function (data) {
            console.log(`get HISTORY init response with: ${JSON.stringify(data)}`);
            data.forEach(d => chat.addMessage(d.content, d.senderType === 'bot' ? 'bot' : 'guest'));
            chat.socket.emit(S_CHANNEL.WELCOME_EVENT_RETURN, chat.user);
        },
        chatException: function (data) {
            console.log('exception: ', data);
        },
        chatDissconnect: function () {
            console.log('Disconnected');
        },
        open: function() {
            let button = $('#widget_button');
            let self = this;
            let body = $('#widget_body');
            body.css({top: button.offset().top - body.outerHeight() - 40 + 'px', left: button.offset().left - body.outerWidth() + 100 + 'px'});
            button.addClass('clicked');
            body.addClass('opened');
            body.toggle('blind', {direction: 'down'}, 1000);
            if (body.offset().top <= 5) {
                $(body).animate({top: '10px'}, 500);
            }
            button.draggable('disable');
            $('#widget_input').empty();
            self.opened = true;
            $('#preview_container').empty().hide('drop', 600);
            self.scrollQuery(1200);
        },
        close: function () {
            let body = $('#widget_body');
            let button = $('#widget_button');
            let self = this;
            button.css({top: body.offset().top + body.outerHeight() + 40 + 'px', left: body.offset().left + body.outerWidth() - button.outerWidth()});
            button.removeClass('clicked');
            body.removeClass('opened');
            body.toggle('blind', {direction: 'down'}, 1000);
            this.opened = false;
            button.draggable('enable');
            if (button.offset().top + button.outerHeight() >= $(window).outerHeight() - 5) {
                $(button).animate({top: $(window).outerHeight() - button.outerHeight() - 10 + 'px'}, 500);
            }
            // self.showPreview(this.lastMessage);
            console.log(self.lastMessage);
        },
        reposition: function(){
            let self = this;
            let body = $('#widget_body');
            let windowHeight = $(window).outerHeight();
            let windowWidth = $(window).outerWidth();
            if (body.offset().top <= 5) {
                $(body).animate({top: '10px'}, 500);
            } else if (body.offset().top + body.outerHeight() > windowHeight) {
                $(body).animate({top: windowHeight - body.outerHeight() - 5 +'px'}, 500);
            }
            if (body.offset().left < 0) {
                $(body).animate({left: '10px'}, 500);
            } else if (body.offset().left + body.outerWidth() > windowWidth) {
                $(body).animate({left: windowWidth - body.outerWidth() - 5 +'px'}, 500);
            }
        },
        addMessage: function (text, sender) {
            let self = this;
            self.messageQueue++;
            setTimeout(function () {
                let options = {direction: ''};
                sender === 'bot' ? (options.direction = 'left', self.lastMessage = text) : options.direction = 'right';
                let newMessage = document.createElement('div');
                $(newMessage).addClass('widget_message ' + sender + '_message');
                $(newMessage).append(text);
                $(newMessage).appendTo('#widget_queue').show('drop', options, 600);
                if (!self.opened) {
                    self.showPreview(text);
                }
                self.messageQueue--;
                self.messageQueue === 0 ?
                    self.scrollQuery(400) : null;
            }, 600);
        },
        scrollQuery: function (timeout) {
            $('#widget_queue').animate({scrollTop: $('#widget_queue')[0].scrollHeight}, timeout);
        },
        showPreview: function (text) {
            let options = {direction: 'left'};
            $('#preview_container').hide('drop', options, 600);
            setTimeout(function () {
                $('#preview_container').empty().append(text).show('fold', options, 600);
            },600);
        },
        initialize: function () {
        },
        clearHistory: function() {
            chat.socket.emit(S_CHANNEL.CLEAR_USER_DATA, {
                message: 'clear my data',
                user: chat.user,
            });
        },
        clearUserData: function (data) {
            console.log('Clear History data => ', data);
            $('#widget_queue').empty();
            lStorage.clear();
            lStorage.set(lStorage.keys.INIT_STATUS, INIT_STATUS.RESET);
            chat.user = null;
            data.forEach(d => chat.addMessage(d, 'bot'));
            chat.socket.emit(S_CHANNEL.INIT_BOT, { id: 16 });
            chat.socket.emit(S_CHANNEL.INIT_USER, { name: 'Guest' });
        },
        welcomeEvent: function(data) {
            data.forEach(d => chat.addMessage(d, 'bot'));
        },
        welcomeReturnEvent: function(data) {
            data.forEach(d => chat.addMessage(d, 'bot'));
        },
        createResponse: function (text) {
            chat.socket.emit(S_CHANNEL.MESSAGE, {
                message: text,
                user: chat.user,
            });
        },
        idleAction: function (timeout) {
          console.log('Idle for ' + timeout + ' seconds');
          idleTimer = setTimeout(function () {
              chat.idleAction(timeout);
          }, timeout);
        },
        getCurrentLocation: function () {
          this.currentLocation = location.href;
          return this.currentLocation;
        },
        showImage: function (category, quantity) {
            let self = this;
            let headers = new Headers();
            headers.append('Authorization', self.APIkey);
            let myInit = {
                method: 'GET',
                headers: headers
            };
            let request =  new Request('https://api.pexels.com/v1/search?query=' + category + '+query&per_page=50&page=1', myInit);
            fetch(request).then(function (response) {
                return response.json();
            }).then(function (jsonResponse) {
                console.log(jsonResponse);
                if (jsonResponse.total_results > 0) {
                    for (let i = 0; i < quantity; i++) {
                        let randomImage = Math.floor(Math.random() * 50);
                        let image = new Image();
                        image.src = jsonResponse.photos[randomImage].src.large;
                        $(image).addClass('message_image');
                        image.addEventListener('click', function () {
                            let lightbox = $('#widget_lightbox');
                            $(lightbox).empty();
                            $(this).clone().appendTo(lightbox);
                            $(lightbox).show('blind', {direction: 'up'}, 700);
                            $('#modal_overlay').show('explode', 800);
                        });
                        self.addMessage(image, 'bot');
                        image.addEventListener('load', function () {
                            console.log($(image).outerHeight());
                            setTimeout(function () {
                                $('#widget_queue').animate({scrollTop: 150}, 700);
                            }, 600);
                        });
                    }
                } else {
                    self.addMessage('Sorry, i was not able to find the images you requested', 'bot');
                }
            });
        }
    };

    chat.initialize();
    let timeout = 5000;

    let idleTimer = setTimeout(function () {
        chat.idleAction(timeout);
    }, timeout);

    $('#human_connect').on('click', function () {
        const content = 'connect with human';
        chat.addMessage(content, 'guest')
        chat.socket.emit('message', {
            message: content,
            user: chat.user,
        })
    });

    $('#widget_input').keydown(function (e) {
        if (e.keyCode == 13) {
            e.preventDefault();
            chat.addMessage($(this).text(), 'guest');
            chat.createResponse($(this).text());
            $(this).empty();
        }
    });

    $('#widget_button').on('click', function(){
        chat.open();
    });

    $('.close_widget').on('click', chat.close);

    $('#clear_history').on('click', chat.clearHistory);

    let resizeTimer;
    $(window).resize(function (){
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(chat.reposition, 500);
    });

    $('.message_image').on('click', function () {
        let lightbox = $('#widget_lightbox');
        $(lightbox).empty();
        $(this).clone().appendTo(lightbox);
       $(lightbox).show('blind', {direction: 'up'}, 700);
       $('#modal_overlay').show('explode', 800);
    });

    $('#modal_overlay').on('click', function () {
        $('#widget_lightbox').hide('scale', 600);
        $(this).hide('explode', 800);
    });

    $(window).mousemove(function () {
        clearTimeout(idleTimer);
        console.log('Mouse move was performed');
        idleTimer = setTimeout(function () {
            chat.idleAction(timeout);
        }, timeout);
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;
    const colors = {
        red: 'red',
        orange: 'orange',
        yellow: 'yellow',
        green: 'green',
        blue: 'blue',
        darkblue: 'darkblue',
        violet: 'violet'
    };
    const colorsList = Object.keys(colors);
    const recognition = new SpeechRecognition();
    const speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
//recognition.continuous = false;
    recognition.lang = 'en-EN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    $('#audio_input').on('click', function () {
        console.log('Recognition started');
        recognition.start();
        recognition.onresult = (event) => {
            event
            const speechToText = event.results[0][0].transcript;
            console.log(speechToText);
        }
    });

    const socket = io('https://kh-gis-chat-bot.intetics.com', {path: '/chat/socket.io'});
    chat.socket = socket;
    chat.socket.on(S_CHANNEL.CONNECT, chat.connect);
    chat.socket.on(S_CHANNEL.INIT_BOT, chat.initBot);
    chat.socket.on(S_CHANNEL.INIT_USER, chat.initUser);
    chat.socket.on(S_CHANNEL.MESSAGE, chat.chatMessage);
    chat.socket.on(S_CHANNEL.INIT_HISTORY, chat.initHistory);
    chat.socket.on(S_CHANNEL.EXCEPTION, chat.chatException);
    chat.socket.on(S_CHANNEL.DISCONNECT, chat.chatDissconnect);
    chat.socket.on(S_CHANNEL.CLEAR_USER_DATA, chat.clearUserData);
    chat.socket.on(S_CHANNEL.WELCOME_EVENT_FIRST, chat.welcomeEvent);
    chat.socket.on(S_CHANNEL.WELCOME_EVENT_RETURN, chat.welcomeReturnEvent());
});
