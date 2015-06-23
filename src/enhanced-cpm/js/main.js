/*
*
* Copyright 2014 - Masters of the Universe
* Lorenzo and Kaelon
*
* This is released by us to the PowerSchool community. Please be careful about modifying this code as
* coding errors can cause corruption of your PSM_ASSET tables.
*
* Please do not change this code and redistribute - let us know if you want to see changes.
* ecpmPowerSchool@gmail.com
*
* */

var editor;

angular.module('tree',['editor', 'service']).run(['$rootScope', '$http', '$q', 'ecpmSvc', function($rootScope, $http, $q, ecpmSvc){
    ecpmSvc.loadTree();

    }]);


angular.module('service',[]).factory('ecpmSvc', ['$rootScope', '$http', '$q', '$modal', function($rootScope, $http, $q, $modal) {

    function modal() {
        var modalDefaults = {
            backdrop: true,
            keyboard: true,
            modalFade: true,
            login: true,
            templateUrl: '/admin/ecpm/partials/dialogs/login.dialog.html'
        };

        var modalOptions = {
            closeButtonText: 'Cancel',
            actionButtonText: 'Submit',
            headerText: 'Login to PowerSchool System Administrator',
            bodyText: 'Login'
        };

        this.showModal = function (customModalDefaults, customModalOptions) {
            if (!customModalDefaults) customModalDefaults = {};
            customModalDefaults.backdrop = 'static';
            return this.show(customModalDefaults, customModalOptions);
        };

        this.show = function (customModalDefaults, customModalOptions) {
            //kill loading dialog if one is set
            loadingDialogInstance.forceClose();

            if (!customModalDefaults) customModalDefaults = {};
            customModalDefaults.backdrop = 'static';

            //Create temp objects to work with since we're in a singleton service
            var tempModalDefaults = {};
            var tempModalOptions = {};

            //Map angular-ui modal custom defaults to modal defaults defined in service
            angular.extend(tempModalDefaults, modalDefaults, customModalDefaults);

            //Map modal.html $scope custom properties to defaults defined in service
            angular.extend(tempModalOptions, modalOptions, customModalOptions);

            if (!tempModalDefaults.controller) {
                tempModalDefaults.controller = function ($scope, $modalInstance) {
                    $scope.modalOptions = tempModalOptions;
                    $scope.modalOptions.ok = function (result) {
                        if(tempModalDefaults.login) {
                            ecpmSvc.login($scope.modalOptions.username, $scope.modalOptions.password)
                                .then(function(result) {
                                    ecpmSvc.loadTree();
                                    $modalInstance.close(result);
                                });
                        }
                        else {
                            var files = $j('input[type=file]')[0].files;
                            var data = new FormData();
                            $j.each(files, function(key, value) {
                                data.append('upload', value);
                            });
                            data.append('filePath', $rootScope.currentPath);
                            ecpmSvc.fileUpload(data).then(function(result){
                                ecpmSvc.refreshTree();
                                $modalInstance.close(result);
                            });
                        }

                    };
                    $scope.modalOptions.close = function (result) {
                        $modalInstance.dismiss('cancel');
                    };
                }
            }

            return $modal.open(tempModalDefaults).result;
        };
    }

    function getNewAssetName(path) {
        if(path.indexOf('/') != -1) {
            return path.substring(path.lastIndexOf('/') + 1);
        }
        else {
            return path;
        }
    }

    function getNewAssetPath(path) {
        if(path.indexOf('/') != -1) {
            return path.substring(0, path.lastIndexOf('/'));
        }
        else {
            return path;
        }
    }

    var ecpmSvc = {
        currentCustomContentId: 0,
        currentAsset: {},

        checkSession: function(response) {
            var defered = $q.defer();
            try {
                response = JSON.parse(response.responseText) || ecpmSvc.keepAlive();
            }
            catch(e) {
                response = "";
            }
            if(typeof response === 'object') {
                defered.resolve(response);
            }
            else {
                var login = new modal();
                login.show().then(function(result) {
                    defered.resolve(result);
                })
            }
            return defered.promise;
        },

        openAbout: function() {
            var about = new modal();
            about.show({
                templateUrl: '/admin/ecpm/partials/dialogs/about.dialog.html',
                login: false
            },{
                closeButtonText: 'Close',
                headerText: 'About the Creators'
            });
        },
        
        importExportUtility: function() {
            window.open('/admin/district/localization/viewCustomPagesImportExport.action');
        },

        login: function(username, password) {
            var deferred = $q.defer();
            var data = {
                j_username: username,
                j_password: password
            };
            this.ajaxCall('/powerschool-sys-mgmt/auth/j_acegi_security_check', 'POST', data).then(function(response){
                deferred.resolve(response);
            });
            return deferred.promise;
        },

        keepAlive: function() {
            return this.getTreeNode();
        },

        loadTree: function() {
            $j('#siteTree').jstree({
                core : {
                    data : function(obj, cb) {
                        var path = this.get_path(obj,'/') || '/',
                            treeData = ecpmSvc.getTreeNode(path);
                        if(typeof treeData === 'object') {
                            treeData = ecpmSvc.parseTree(treeData, obj);
                            cb.call(this, treeData);
                        }
                        else {
                            var login = new modal();
                            login.show().then(function (result) {
                                treeData = ecpmSvc.parseTree(result, obj);
                                cb.call(this, treeData);
                            });
                        }
                    },
                    themes : {
                        'responsive' : false,
                        'variant' : 'small',
                        'stripes' : true
                    },
                    check_callback : function(operation, node, node_parent, node_position, more) {
                        if(more && more.dnd && more.pos !== 'i') { return false; }
                        if(operation === "move_node" || operation === "copy_node") {
                            if(this.get_node(node).parent === this.get_node(node_parent).id) { return false; }
                        }
                        return true;
                    }
                },
                sort : function(a, b) {
                    return this.get_type(a) === this.get_type(b) ? (this.get_text(a) > this.get_text(b) ? 1 : -1) : (this.get_type(a) >= this.get_type(b) ? 1 : -1);
                },
                contextmenu : {
                    items : function(node) {
                        var tmp = $j.jstree.defaults.contextmenu.items();
                        delete tmp.create.action;
                        delete tmp.mode.action;
                        tmp.create.label = "New";
                        tmp.create.submenu = {
                            create_folder: {
                                label: "Folder",
                                separator_after: true,
                                action: function (data) {
                                    var inst = $j.jstree.reference(data.reference),
                                        obj = inst.get_node(data.reference);
                                    //console.log([obj, inst])
                                    inst.create_node(obj, { type : "folder", text : "New folder" }, "last", function (new_node) {
                                        setTimeout(function () { inst.edit(new_node); },0);
                                    });
                                }
                            },
                            create_file : {
                                label: "File",
                                action: function (data) {
                                    var inst = $j.jstree.reference(data.reference),
                                        obj = inst.get_node(data.reference);
                                    inst.create_node(obj, { type : "file", text : "New file" }, "last", function (new_node) {
                                        setTimeout(function () { inst.edit(new_node); },0);
                                    });
                                }
                            }
                        };
                        if(this.get_type(node) === "file") {
                            delete tmp.create;
                        }
                        tmp.upload = {
                            label: "Upload",
                            separator_after: true,
                            action: function() {
                                var upload = new modal();
                                upload.show({
                                    templateUrl: "/admin/ecpm/partials/dialogs/upload.dialog.html",
                                    login: false
                                },{
                                    headerText: "File Upload"
                                }).then(function(result) {
                                    console.log('upload');
                                })
                            }
                        }
                        tmp.mode.label = "Set Mode";
                        tmp.mode.submenu = {
                            set_mode: {
                                label: "SQL",
                                separator_before: true,
                                action: function(data) {
                                    editor.getSession().setMode("ace/mode/sql");
                                }
                            }
                        };
                        if(this.get_type(node) === "default" || this.get_type(node) === "folder") {
                            delete tmp.mode;
                        }
                        tmp.remove._disabled = (this.get_type(node) === 'file' ? false : true);
                        return tmp;
                    }
                },
                types : {
                    default : { 'icon' : 'folder' },
                    file : { 'valid_children' : [], 'icon' : 'file' }
                },
                plugins : ['sort','types','contextmenu']
            });
        },

        getLocalContent: function() {
            return editor.getSession().getValue();
        },

        translatedEditorMode: {
            js: 'javascript',
            txt: 'text'
        },

        setLocalContent: function(assetContent) {
            //set mode first
            var filetype = this.curFiletype[1] || '';
            if(this.translatedEditorMode[filetype]) {
                filetype = this.translatedEditorMode[filetype];
            }
            editor.getSession().setMode("ace/mode/" + filetype);
            //set editor content
            editor.getSession().setValue(assetContent);
            loadingDialogInstance.forceClose(); //just in case we have a dialog window open
        },

        parseTree: function(data, obj) {
            data.folder.id = (data.folder.id === 1 ? '#' : obj.original.id);
            var tmpPages = data.folder.pages; //temp hold the pages so we can place them after folders

            //subfolders
            data.folder.pages = _.filter(data.folder.subFolders, function(sb){
                sb.pages = true;
                if(sb.custom){
                    sb.icon = 'folder folder-custom';
                }
                return sb;
            });

            //pages
            //var resortedPages = tmpPages.sort(function(a,b){
            //    return (a.name < b.name ? -1 : 1);
            //});
            var pageFrag = {};
            var filePages = _.filter(tmpPages, function(p){
                p.type = 'file';
                p.pages = [];
                // TODO: this is for page fragment children in the future 1
                /*if(p.name.split('.').length > 4) {
                    var name = p.name;
                    var parentPage = name.substring(name.indexOf('.'),0) + '.html';
                    pageFrag[parentPage] = p;
                }*/
                //set icon
                var filetype = p.name.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
                p.icon = 'file file-' + filetype[1];
                if(p.custom) {
                    p.a_attr = {
                        class: 'custom-asset'
                    };
                }
                return p;
            });
            // TODO: this is for page fragment children in the future 2
            /*if(!_.isEmpty(pageFrag)) {
                _.each(filePages, function(page, index) {
                    _.filter(pageFrag, function(fragment, parentPage){
                        if(parentPage === page.name) {
                            page.pages.push(fragment);
                        }
                        else if(fragment.name === page.name) {
                            filePages.splice(index,1);
                        }
                    });
                });
            }*/
            data.folder.pages = _.union(data.folder.pages, filePages)
            return data.folder.pages;
        },

        refreshTree: function() {
            $j('#siteTree').jstree(true).refresh();
        },

        getTreeNode: function(path, cb) {
            path = path || $rootScope.currentPath;
            var data = {
                path: path,
                maxDepth: 1,
                rnd: Math.floor(Math.random()*1E10)
            };
            this.ajaxCall('/powerschool-sys-mgmt/custompages/tree.action', 'GET', data).then(function(response){
                cb = response;
            });
            return cb;
        },

        getContentId: function(path) {
            var data = {
                path: path
            };
            this.ajaxCall('/powerschool-sys-mgmt/custompages/retrieveCustomPageHistory.action', 'POST', data).then(function(response){
                //this.currentAsset = response; //set current asset
                if(response.activeCustomContentId === 0) {
                    ecpmSvc.currentCustomContentId = response.customContentId;
                }
                else if(!!response.versionAssetContentIds) { //multiple versions, take the first (active one?) for now
                    ecpmSvc.currentCustomContentId = response.versionAssetContentIds[0];
                }
            });
        },

        getAssetContent: function(path) {
            var data = {
                path: path,
                LoadFolderInfo: false,
                rnd: Math.floor(Math.random()*1E10)
            };
            return this.checkSession(ecpmSvc.ajaxCall('/powerschool-sys-mgmt/custompages/builtintext.action', 'GET', data))
                .then(function(response) {
                    $rootScope.fileSelected = true;
                    ecpmSvc.currentAsset = response; //set current asset
                    var contentText = "";
                    if(response.isCustom && response.activeCustomContentId !== 0) {
                        ecpmSvc.currentCustomContentId = response.activeCustomContentId;
                        contentText = response.activeCustomText;
                    }
                    else if(response.isCustom) {
                        ecpmSvc.currentCustomContentId = response.versionAssetContentIds[0];
                        contentText = response.activeCustomText;
                    }
                    else {
                        contentText = response.builtInText;
                    }
                    ecpmSvc.currentAsset.contentText = contentText;
                    return contentText;
            });
        },

        customizeAsset: function() {
            var data = {
                initialAssetContent: this.currentAsset.builtInText,
                newAssetName: getNewAssetName(this.currentAsset.path),
                newAssetPath: getNewAssetPath(this.currentAsset.path),
                newAssetType: 'file'
            };
            this.ajaxCall('/powerschool-sys-mgmt/custompages/customizeAsset.action', 'POST', data).then(function(response){
                ecpmSvc.currentCustomContentId = response.activeCustomContentId; //set current asset content id
                return ecpmSvc.currentCustomContentId;
            });
        },

        deleteCustomAsset: function(path) {
            var defer = $q.defer();
            var data = {
                path: path
            };
            this.ajaxCall('/powerschool-sys-mgmt/custompages/deleteCustomFile.action', 'POST', data).then(function(result){
                defer.resolve(result);
            });
            return defer.promise;
        },

        saveAsset: function(content, contentId, contentPath, keyPath) {
            $rootScope.feedback = 'add';
        },

        publishAsset: function(content, contentPath, contentId, keyPath) {
            loadingDialogInstance.open('Saving page content');
            //get key path
            var n = contentPath.indexOf(".", 0);
            if (n != -1 && !!!keyPath) {
                keyPath = contentPath.substring(0, n).replace(/\/+/,'');
                keyPath = keyPath.replace(/\//g,'.');
            }

            if(!this.currentAsset.isCustom) {  // if current asset is non-custom, ask user
                if(confirm("Current asset is not customized, would you like to customize it?")) {
                    this.customizeAsset(); //yes - put a promise on this
                }
                else {
                    loadingDialogInstance.forceClose();
                    return false; //no
                }
            }
            else if(!!!ecpmSvc.currentCustomContentId) { //if current content id is blank, get it
                ecpmSvc.getContentId(contentPath);
            }

            var data = {
                customContentId: ecpmSvc.currentCustomContentId,
                customContent: content,
                customContentPath: contentPath,
                keyPath: keyPath
            };
            return this.ajaxCall('/powerschool-sys-mgmt/custompages/publishCustomPageContent.action', 'POST', data).then(function(response){
                if(response.activeCustomContentId === 0) {
                    ecpmSvc.currentCustomContentId = response.customContentId;
                    $rootScope.feedback = response;
                    ecpmSvc.getAssetContent(ecpmSvc.currentAsset.path).then(function(refreshedContent){
                        ecpmSvc.setLocalContent(refreshedContent);
                        loadingDialogInstance.forceClose();
                    });
                }
            });
        },

        createAsset: function(assetName, type, location) {
            var data = {
                newAssetName: assetName,
                newAssetPath: $rootScope.currentPath,
                newAssetType: type
            };
            this.ajaxCall('/powerschool-sys-mgmt/custompages/createAsset.action', 'POST', data).then(function(response){
                $rootScope.feedback = response.returnMessage;
            });
        },

        ajaxCall: function(url, type, data, datatype) {
            var returnContent = $q.defer();
            return $j.ajax({
                url: url,
                type: type,
                data: data,
                dataType: datatype,
                async: false,
                success: function(response, status, xhr) {
                    try {
                        response = JSON.parse(response);
                    }
                    catch(e) {
                        //alert('error: ' + e);
                    }
                    return returnContent.resolve(response);
                },
                error: function(e) {
                    alert('err');
                    return e;
                }
            });

        },

        fileUpload: function(data) {
            var returnContent = $q.defer();
            $j.ajax({
                url: '/powerschool-sys-mgmt/custompages/fileUpload.action',
                type: 'POST',
                data: data,
                cache: true,
                dataType: 'json',
                processData: false, // Don't process the files
                contentType: false, // Set content type to false as jQuery will tell the server its a query string request
                success: function(response, textStatus, jqXHR) {
                    try {
                        response = JSON.parse(response);
                    }
                    catch(e) {
                        //alert('error: ' + e);
                    }
                    returnContent.resolve(response);
                }
            });
            return returnContent.promise;
        }
    };
    return ecpmSvc;
}]);

angular.module('editor',['service'])

    .controller("editorCtrl", ['$rootScope', '$scope', '$compile', '$modal', 'ecpmSvc', function($rootScope, $scope, $compile, $modal, ecpmSvc) {

        editor = ace.edit("editor");
        editor = ace.edit("editor");
        editor.setTheme("ace/theme/xcode");
        editor.getSession().setMode("ace/mode/html");
        editor.setOptions({
            autoScrollEditorIntoView: true,
            scrollPastEnd: true
        });

        $scope.tabs = [];

        $scope.$on('addTab', function(event, content){
            var tabExists = 0;
            var title = content.path.substring(content.path.lastIndexOf('/')+1),
                filetype = title.match(/\.([0-9a-z]+)(?:[\?#]|$)/i)[1];
            ecpmSvc.curFiletype = filetype;
            if(ecpmSvc.translatedEditorMode[filetype]) {
                filetype = ecpmSvc.translatedEditorMode[filetype];
            }
            //check tab exists
            angular.forEach($scope.tabs, function(tab){
                if(tab.path === content.path) {
                    tabExists = 1;
                }
            });
            if (tabExists === 1) {
                if(confirm("This file is already open. You are enabling duplicate tabs for this file.")) {

                }
                else {
                    return false; //no
                }
            }

            //set filetype and session after translation
            var thisTabSession = ace.createEditSession('editor', 'ace/mode/' + filetype);
            thisTabSession.setValue(content.contentText);
            editor.setSession(thisTabSession);

            $scope.tabs.push({
                id: content.activeCustomContentId,
                active: true,
                assetContent: content,
                title: title,
                path: content.path,
                hover: content.path,
                filetype: filetype,
                session: thisTabSession,
                content: content.contentText
            });


        });

        $scope.selectTab = function(tab) {
            tab.active = true;
            var session = tab.session;
            ecpmSvc.currentAsset = tab.assetContent;
            if(tab.assetContent.activeCustomContentId === 0) {
                ecpmSvc.currentCustomContentId = ecpmSvc.getContentId(tab.assetContent.path);
            }
            else {
                ecpmSvc.currentCustomContentId = tab.assetContent.activeCustomContentId;
            }
            $rootScope.currentPath = tab.assetContent.path;
            editor.setSession(session);
            //ecpmSvc.setLocalContent(content);
        };

        $j('#siteTree').bind('select_node.jstree', function(event, data){
            var type = data.instance.get_type(data.selected);
            if(type === 'file') { // if it's not a file, ignore it
                loadingDialogInstance.open('Loading page content...');
                $rootScope.currentPath = '/' + data.instance.get_path(data.selected, '/');
                ecpmSvc.curFiletype = data.instance.get_text(data.selected).match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
                ecpmSvc.getAssetContent($rootScope.currentPath).then(function(result){
                    //ecpmSvc.setLocalContent(result);
                    $rootScope.$broadcast('addTab', ecpmSvc.currentAsset);
                    loadingDialogInstance.forceClose();
                });
            }
            else if(type === 'default' || type === 'folder') {
                $rootScope.currentPath = '/' + data.instance.get_path(data.selected, '/');
                data.instance.toggle_node(data.selected);
            }
        }).bind('activate_node.jstree', function(event,data){
            $rootScope.currentPath = '/' + data.instance.get_path(data.node, '/');
        }).bind('load_node.jstree', function(event, data){
            if(data.status) {
                loadingDialogInstance.forceClose();
            }
            else {
                alert("There was a problem loading this content.");
                loadingDialogInstance.forceClose();
            }
        });

        $j('#siteTree').on('create_node.jstree',function(e, data) {
            if(data.node.type === 'file'){
                data.node.a_attr = {
                    class: 'custom-asset'
                }
            }
            else if(data.node.type === 'folder' || data.node.type === 'default') {
                data.node.icon = 'folder folder-custom';
            }
        })
            .on('rename_node.jstree', function (e, data) {
                var contentType = data.node.original.type || data.node.type;
                ecpmSvc.createAsset(data.text, contentType);
            });

        $j('#siteTree').on('delete_node.jstree', function (e, data) {
            var contentType = data.node.original.type || data.node.type;
            if(contentType === 'file') {
                var contentPath = data.instance.get_path(data.node,'/');
                ecpmSvc.deleteCustomAsset('/' + contentPath).then(function(result){
                    $rootScope.feedback = result.returnMessage;
                    data.instance.refresh();
                });
            }
        });

        var keepAlive = setInterval(function() {
            ecpmSvc.keepAlive();
        }, 300000); //5mins
    }])

    .directive("tabDismiss", ['$rootScope', function($rootScope) {
        return {
            restrict: "EA",

            link: function(scope, element, attrs) {
                element.on('click', function(){
                    scope.tabs.splice(scope.$index, 1);
                    var newCurrentTabIndex = (scope.$index - 1 < 0 ? 0 : scope.$index - 1);
                    if(newCurrentTabIndex >= 0 && scope.tabs.length > 0) {
                        scope.tabs[newCurrentTabIndex].active = true;
                    }
                    else {
                        $rootScope.fileSelected = false;
                    }
                });
            }
        }
    }])

    .controller("feedbackCtrl", ['$rootScope', '$scope', '$timeout', 'ecpmSvc', function($rootScope, $scope, $timeout, ecpmSvc) {
        $rootScope.$watch('feedback', function(scope, oldVal, content){
            if(typeof $rootScope.feedback === 'object') {
                $scope.feedback = $rootScope.feedback.returnMessage;
            }
            else {
                $scope.feedback = $rootScope.feedback;
            }
            $timeout(function(){
                $scope.feedback = "";
            }, 10000)
        })

    }])

    .controller("toolbarCtrl", ['$rootScope', '$scope', 'ecpmSvc', function($rootScope, $scope, ecpmSvc) {
        $scope.publishAsset = function() {
            return ecpmSvc.publishAsset(ecpmSvc.getLocalContent(), $rootScope.currentPath);
        };

        $scope.openAbout = function() {
            ecpmSvc.openAbout();
        };

        $scope.importExportUtility = function() {
            ecpmSvc.importExportUtility();
        };

        $scope.dropData = {
            snippet:  {
                Box: '\n<div class=\"box-round\">\n    <h2>Your title here...<\/h2>\n    <p>Your content here...<\/p> \n<\/div>\n', afterInsert:function(h) {clearStatusButtonClick();},
                Tabs: '\n<ul class=\"tabs\">\n    <li class=\"selected\"> \n        <a href=\"#\">Tab One<\/a> \n    <\/li>\n    <li>\n        <a href=\"#\">Tab 2<\/a>\n    <\/li>\n    <li>\n        <a href=\"#\">Tab 3<\/a>\n    <\/li> \n<\/ul>\n',
                DynamicTabs: '\n<div class=\"tabs\">\n    <ul class=\"group\">\n        <li><a href=\"#tabOneContent\">Tab 1<\/a><\/li>\n        <li><a href=\"#tabTwoContent\">Tab 2<\/a><\/li>\n        <li><a href=\"#tabThreeContent\">Tab 3<\/a><\/li>\n    <\/ul>\n    <div id=\"tabOneContent\">\n        <p>Content 1 here<\/p>\n    <\/div>\n    <div id=\"tabTwoContent\">\n        <p>Content 2 here<\/p>\n    <\/div>\n    <div id=\"tabThreeContent\">\n        <p>Content 3 here<\/p>\n    <\/div>\n<\/div>\n',
                Toggle: '\n<div class=\"box-round\">\n    <h2 class=\"toggle expanded\">Title here<\/h2>\n    <div> \n        <p>Content goes here<\/p>\n    <\/div>\n<\/div>\n',
                Dialog: '\n<a title=\"Dialog title goes here\" class=\"dialog\" id=\"uniqueID\" href=\"contentOfDialogURL.html\">Link to open dialog<\/a>\n',
                Calendar: '\n        <input class=\"psDateWidget\" type=\"date\" name=\"fieldUniqueName\" size=\"11\" value=\"\" id=\"fieldUniqueName\" \/>\n',
                Table: '\n<!-- This is a standards driven table. there are no styles, borders, widths and there is a header row--> \n   <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" class=\"grid\" id=\"tableUniqueID\"> \n   <CAPTION>This text appears above the table<\/CAPTION>\n   <thead> \n     <tr> \n       <th>H1 content<\/th> \n       <th>H2 content<\/th> \n       <th>H3 content<\/th> \n     <\/tr> \n   <\/thead> \n   <tfoot> \n     <tr> \n       <td colspan=\"3\">This will display at the bottom of the table. Ideal for legends.<\/td> \n         <\/tr> \n   <\/tfoot> \n   <tbody> \n     <tr> \n       <td>R1C1 content<\/td> \n       <td>R1C2 content<\/td> \n       <td>R1C3 content<\/td> \n     <\/tr> \n     <tr> \n       <td>R2C1 content<\/td> \n       <td>R2C2 content<\/td> \n       <td>R2C3 content<\/td> \n     <\/tr> \n    <\/tbody> \n   <\/table> \n'
            },
            template: {
                Admin: '<!DOCTYPE html>\n<html>\n<head>\n <title>Your Page Title Goes Here<\/title>\n<!-- required scripts -->\n ~[wc:commonscripts] \n<!-- Required style sheets: screen.css, and print.css --> \n <link href=\"\/images\/css\/screen.css\" rel=\"stylesheet\" media=\"screen\">\n <link href=\"\/images\/css\/print.css\" rel=\"stylesheet\" media=\"print\">\n<\/head> \n<body> \n ~[wc:admin_header_css] \n <div id=\"breadcrumbs\"> \n <!-- breadcrumb start -->Your breadcrumbs go here<!-- breadcrumb end --> \n <\/div> \n<!-- start of main menu and content --> \n ~[wc:admin_navigation_css] \n<!-- Start of Page --> \n <h1>Your Page Title Goes Here<\/h1> \n<!-- start of content area --> \n <div class=\"box-round\"> \n <h2>Section Title Text Goes Here<\/h2> \n <p> \n Your paragraph text goes here. \n <\/p> \n <\/div> \n<!-- end of content area --> \n ~[wc:admin_footer_css] \n<\/body> \n<\/html>',
                AdminStudent: '<!DOCTYPE html>\n<html>\n<head>\n <title>Your Page Title Goes Here<\/title>\n<!-- required scripts -->\n ~[wc:commonscripts] \n<!-- Required style sheets: screen.css, and print.css -->\n <link href=\"\/images\/css\/screen.css\" rel=\"stylesheet\" media=\"screen\">\n <link href=\"\/images\/css\/print.css\" rel=\"stylesheet\" media=\"print\">\n<\/head> \n<body> \n ~[wc:admin_header_frame_css]\n <!-- breadcrumb start -->\n <a href=\"\/admin\/home.html\" target=\"_top\">Start Page<\/a> &gt; <a href=\"\/admin\/students\/home.html?selectstudent=nosearch\" target=\"_top\">Student Selection<\/a> &gt; Your Page Title Goes Here\n <!-- breadcrumb end -->\n~[wc:admin_navigation_frame_css]\n<!-- start of main menu and content -->\n~[wc:title_student_begin_css]Your Page Title Goes Here~[wc:title_student_end_css]\n<form action=\"\/~[self.page]?frn=~(studentfrn)&changesSaved=true\" method=\"POST\">\n<!-- start of content area -->\n~[if.~(gpv.changesSaved)=true]<div class=\"feedback-confirm\">~[text:psx.common.changes_recorded]<\/div>[\/if]\n <div class=\"box-round\">\n <h2>Section Title Text Goes Here<\/h2>\n <p>\n Your paragraph text goes here.\n <\/p>\n <div class=\"button-row\"><input type=\"hidden\" name=\"ac\" value=\"prim\">~[submitbutton]<\/div>\n <\/div>\n<\/form>\n<!-- end of content area -->\n ~[wc:admin_footer_frame_css]\n<\/body> \n<\/html>',
                Teacher: '<!DOCTYPE html>\n<html>\n<head>\n <title>Your Page Title Goes Here<\/title>\n<!-- required scripts -->\n ~[wc:commonscripts] \n<!-- Required style sheets: screen.css, and print.css -->\n <link href=\"\/images\/css\/screen.css\" rel=\"stylesheet\" media=\"screen\">\n <link href=\"\/images\/css\/print.css\" rel=\"stylesheet\" media=\"print\">\n<\/head> \n<body> \n~[wc:teachers_header_css] \n~[wc:teachers_navigation_css] \n<!-- sets active navigation tab --> \n~[SetPostValue:tabname=home] \n~[wc:teachers_nav_css] \n <h1>Your Page Title Goes Here<\/h1> \n <form name=\"navigation\"> \n<!-- start of content area --> \n <div class=\"box-round\"> \n <h2>Section Title Text Goes Here<\/h2> \n <p> \n Your paragraph text goes here. \n <\/p> \n <\/div> \n<!-- end of content area --> \n~[wc:teachers_footer_css]\n<\/body> \n<\/html>',
                TeacherBackpack: '<!DOCTYPE html>\n<html>\n<head>\n <title>Your Page Title Goes Here<\/title>\n<!-- required scripts -->\n ~[wc:commonscripts] \n<!-- Required style sheets: screen.css, and print.css -->\n <link href=\"\/images\/css\/screen.css\" rel=\"stylesheet\" media=\"screen\">\n <link href=\"\/images\/css\/print.css\" rel=\"stylesheet\" media=\"print\">\n<script type=\"text\/javascript\">\n <!-- Begin\n function formHandler(form){\n var URL = document.navigation.page.options[document.navigation.page.selectedIndex].value;\n window.location.href = URL;\n }\n \/\/ End -->\n<\/script>\n<\/head>\n<body>\n\n~[wc:teachers_header_fr_css]\n\n <form name=\"navigation\"><span class=\"account-photo\">~[studenttitlephoto]<\/span>\n <h1>Your Page Title Goes Here<span class=\"nav-teacher\"><select name=\"page\" size=1 onChange=\"javascript:formHandler()\"><option value=\"\">Select Screens<\/option><option value=\"\">--------------------<\/option>~[x:teacherpages]<\/select><\/span>~[studentalert]<\/h1>\n<p>~(studentname) &nbsp; ~(grade_level) &nbsp; ~(student_number) &nbsp; &nbsp; ~(track) &nbsp; &nbsp; ~(studschoolabbr) &nbsp; &nbsp; ~[enrollmentstatus]<\/p><\/form>\n\n <div class=\"box-round\">\n <p>\n Your paragraph text goes here.\n <\/p>\n <\/div>\n<!-- end of content area -->\n~[wc:teachers_footer_fr_css]\n<\/body>\n<\/html>',
                Parent: '<!DOCTYPE html>\n<html>\n<head>\n <title>Your Page Title Goes Here<\/title>\n<!-- start of page body --> \n~[wc:guardian_header] \n <h1>Your Page Title Goes Here<\/h1> \n<!-- start student content --> \n <div class=\"box-round\"> \n <h2>Section title goes here<\/h2> \n <p>Your paragraph text goes here<\/p> \n <\/div> \n<!-- end student content --> \n<!-- Sets the navigation highlighting: the value is the ID value of the navigation element you want to highlight--> \n<input id=\"activeNav\" type=\"hidden\" value=\"#btn-gradesAttendance\"\/> \n<!-- end of page body --> \n~[wc:guardian_footer] \n<\/body> \n<\/html>'
            }
        };

        $scope.insertSnippet = function(type){
            editor.insert($scope.dropData.snippet[type]);
        };

        $scope.insertTemplate = function(type){
            editor.getSession().setValue($scope.dropData.template[type]);
        };
    }]);


var ecpm = angular.module("ecpm", [
    'ui.bootstrap',
    'service',
    'tree',
    'editor']);