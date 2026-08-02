<template>
  <template>
    <template id="editor-template">
      <div id="main-ui" class="editor-ui">
        <div id="content">
          <div id="container">
            <div id="select-box"></div>
            <svg width="100%" height="100%" id="main-view-svg">
              <g id="grid-lines-wrapper" />
            </svg>
          </div>

          <!-- div id="image"></div -->
          <div id="floating-things">
            <div id="floating-labels" class="non-selectable"></div>
          </div>

          <div id="batch-box-editor">
            <div id="batch-box-editor-header"></div>
            <div id="batch-box-editor-group"></div>
          </div>

          <div id="obj-editor">
            <div class="obj-editor-row" id="obj-editor-buttons">
              <div id="label-copy" class="ui-button" title="copy (C-c)">
                <!-- <span class="ui-icon ui-icon-copy"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <!-- <rect x="4" y="4" width="12" height="12"/> -->
                    <rect x="8" y="8" width="12" height="12" />
                    <polyline points="8 16 4 16 4 4 16 4 16 8 " />
                  </g>
                </svg>
              </div>
              <div id="label-paste" class="ui-button" title="auto adjust">
                <!-- <span class="ui-icon ui-icon-key"></span></div> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <!-- <rect x="4" y="8" width="16" height="12"/>
                    <circle cx="12" cy="8" r = "4"/>								 -->
                    <circle cx="12" cy="12" r="4" />
                    <rect x="10" y="16" width="4" height="4" />
                    <polyline points="12 3 12 6" />
                    <polyline points="3 12 6 12" />
                    <polyline points="18 12 21 12" />
                    <polyline points="5 5 8 8" />
                    <polyline points="18 5 15 8" />
                  </g>
                </svg>
              </div>
              <div id="label-batchedit" class="ui-button" title="edit multiple instances">
                <!-- <span class="ui-icon ui-icon-zoomin"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <rect x="4" y="4" width="8" height="8" />
                    <rect x="4" y="12" width="8" height="8" />
                    <rect x="12" y="4" width="8" height="8" />
                  </g>
                </svg>
              </div>

              <div id="label-trajectory" class="ui-button" title="trajectory">
                <!-- <span class="ui-icon ui-icon-zoomin"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <path d="M 4 4 C 20 4, 4 20, 20 20" />
                  </g>
                </svg>
              </div>

              <div id="label-highlight" class="ui-button" title="focus">
                <!-- <span class="ui-icon ui-icon-zoomin"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <circle cx="10" cy="10" r="7" />
                    <polyline points="15 15 20 20" />
                    <polyline points="10 6 10 14" />
                    <polyline points="6 10 14 10" />
                  </g>
                </svg>
              </div>
              <div id="label-edit" class="ui-button" title="edit">
                <!-- <span class="ui-icon ui-icon-pencil"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <polyline points="12 4 12 20" />
                    <polyline points="4 9 12 9" />
                    <polyline points="8 5 12 9 8 13" />
                    <polyline points="20 15 12 15" />
                  </g>
                  <!-- <polyline points="16 19 12 15  16 11" /> -->
                </svg>
              </div>
              <div id="label-rotate" class="ui-button" title="reverse direction (g)">
                <!-- <span class="ui-icon ui-icon-transferthick-e-w"></span></div> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <!-- <rect x=6 y=4 width=12 height=8 />
                    <polyline points="12 12 12 20" />
                    <polyline points="8 16 12 20 16 16" /> -->
                    <rect x="8" y="8" width="8" height="8" />

                    <polyline points="12 12 12 21" />
                    <polyline points="10 19 12 21 14 19" />

                    <polyline points="12 12 12 3" stroke-dasharray="1" />
                    <polyline points="10 5 12 3 14 5" stroke-dasharray="1" />
                  </g>
                </svg>
              </div>

              <div id="label-del" class="ui-button" title="delete (Del)">
                <!-- <span class="ui-icon ui-icon-trash"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </g>
                </svg>
              </div>

              <div id="label-more" class="ui-button">
                <!-- <span class="ui-icon ui-icon-trash"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <g>
                      <circle cx="7" cy="12" r="0.5" />
                      <circle cx="12" cy="12" r="0.5" />
                      <circle cx="17" cy="12" r="0.5" />
                    </g>
                  </g>
                </svg>

                <div id="object-dropdown-menu" class="non-selectable">
                  <div class="menu-item" id="cm-delete-obj">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Delete this object (in all frames)</div>
                  </div>
                  <div class="menu-item" id="cm-modify-obj-type">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Sync object type & attr</div>
                  </div>
                  <div class="menu-item" id="cm-modify-obj-size">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Sync object size</div>
                  </div>

                  <div class="menu-item" id="cm-reset-obj-size">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Reset object size</div>
                  </div>

                  <div class="menu-item menu-seperator"></div>
                  <div class="menu-item" id="cm-auto-ann-background">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Auto ann. it in background</div>
                  </div>
                  <div class="menu-item" id="cm-interpolate-background">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">interpolate it in background</div>
                  </div>
                  <div class="menu-item" id="cm-re-interpolate-background">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">re-interpolate all in background</div>
                  </div>

                  <div class="menu-item menu-seperator"></div>
                  <div class="menu-item" id="cm-select-as-ref">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Copy/Select as Ref</div>
                  </div>
                  <div class="menu-item menu-seperator"></div>
                  <div class="menu-item" id="cm-change-id-to-ref">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Change ID to Ref</div>
                  </div>
                  <div class="menu-item" id="cm-change-id-to-ref-in-scene">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Change ID to Ref in all frames</div>
                  </div>
                  <div class="menu-item menu-seperator"></div>
                  <div class="menu-item" id="cm-follow-ref">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Follow Ref</div>
                  </div>

                  <div class="menu-item" id="cm-sync-followers">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Sync followers</div>
                  </div>

                  <div class="menu-item" id="cm-follow-static-objects">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Follow Static Objects</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="obj-editor-row">
              <select title="category" id="object-category-selector"></select>

              <input title="tracking id" list="obj-ids-of-scene" id="object-track-id-editor" type="text" size="5"
                placeholder="track id" />
              <datalist id="obj-ids-of-scene"></datalist>
              <div id="label-gen-id" class="ui-button" title="generate ID">
                <!-- <span class="ui-icon ui-icon-copy"></span> -->
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                  <g>
                    <!-- <rect x="4" y="4" width="12" height="12"/> -->
                    <rect x="6" y="6" width="12" height="12" />
                  </g>
                </svg>
              </div>
            </div>
            <div class="obj-editor-row">
              <div id="attr-editor">
                <input title="attribute" id="attr-input" type="text" size="10" placeholder="attribute" />
                <div id="attr-selector"> </div>
              </div>
            </div>
            <div class="obj-editor-row">
              <div id="object-info"> </div>
            </div>
          </div>
        </div>

        <div id="context-menu-wrapper" class="non-selectable">
          <div id="context-menu">
            <div class="menu-item" id="cm-new">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">New</div>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>
              <div id="new-submenu"> </div>
            </div>

            <div class="menu-item" id="cm-paste" title="hold shift key to disable auto-adjust">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Paste</div>
            </div>

            <div class="menu-item" id="cm-interpolate-cur-obj">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Intepolate current object</div>
            </div>

            <div class="menu-item" id="cm-auto-annotate-cur-obj">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Auto annotate current object</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-goto">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Go to</div>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>
              <div id="goto-submenu">
                <div class="menu-item" id="cm-prev-frame">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">Previous frame (3)</div>
                </div>

                <div class="menu-item" id="cm-next-frame">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">Next frame (4)</div>
                </div>

                <div class="menu-item" id="cm-first-frame">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">First frame</div>
                </div>
                <div class="menu-item" id="cm-last-frame">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">Last frame</div>
                </div>

                <div class="menu-item menu-seperator"></div>
                <div class="menu-item" id="cm-prev-object">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">Previous object (1)</div>
                </div>

                <div class="menu-item" id="cm-next-object">
                  <div class="menu-item-icon"></div>
                  <div class="menu-item-text">Next object (2)</div>
                </div>

                <!-- <div class="menu-item menu-seperator"></div>
                  <div class="menu-item" id="cm-go-to-10hz">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Full 10hz scene</div>
                  </div>
                  
                  <div class="menu-item" id="cm-go-to-full-2hz">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">Full 2Hz scene</div>
                  </div>

                  <div class="menu-item" id="cm-go-to-2hz">
                    <div class="menu-item-icon"></div>
                    <div class="menu-item-text">2Hz scene</div>
                  </div> -->
              </div>
            </div>

            <div class="menu-item" id="cm-play">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Play</div>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>
              <div id="play-submenu">
                <div class="menu-item" id="cm-play-2fps">
                  <div class="menu-item-text">2 FPS</div>
                </div>
                <div class="menu-item" id="cm-play-10fps">
                  <div class="menu-item-text">10 FPS</div>
                </div>
                <div class="menu-item" id="cm-play-20fps">
                  <div class="menu-item-text">20 FPS</div>
                </div>
                <div class="menu-item" id="cm-play-50fps">
                  <div class="menu-item-text">50 FPS</div>
                </div>
              </div>
            </div>

            <div class="menu-item" id="cm-pause">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Pause/Resume (Space)</div>
            </div>

            <div class="menu-item" id="cm-stop">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Stop</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-save">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Save (C-s)</div>
            </div>

            <!-- <div class="menu-item" id="cm-save-all">
                <div class="menu-item-icon"></div>
                <div class="menu-item-text">Save All</div>
                <div id="saveall-submenu"></div>		
              </div> -->

            <div class="menu-item" id="cm-reload">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reload (C-r)</div>
            </div>

            <div class="menu-item" id="cm-reload-all">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reload All</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-reset-view">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reset view</div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-show-frame-info">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Frame info</div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-show-stat">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Stat</div>
            </div>

            <div class="menu-item" id="cm-check-3d-labels">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Check 3d labels</div>
            </div>

            <div class="menu-item" id="cm-check-2d-labels">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Check 2d labels</div>
            </div>

            <div class="menu-item" id="cm-show-all-objs">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Show all objects</div>
            </div>

            <!-- <div class="menu-item" id="cm-show-objs-of-type">
                <div class="menu-item-icon"></div>
                <div class="menu-item-text">Show objects of type</div>
                <div class="menu-item-arrow menu-item-icon">
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon"><g>
                    <path d="M12 8 L 18 12 L 12 16Z"></path>
                  </g></svg>
                </div>
                <div id="show-submenu">
                </div>
              </div> -->
          </div>

          <div id="object-context-menu">
            <div class="menu-item" id="cm-delete">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Delete</div>
            </div>

            <div class="menu-item" id="cm-delete-obj">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Delete this object (in all frames)</div>
            </div>
            <div class="menu-item" id="cm-modify-obj-type">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Sync object type & attr</div>
            </div>
            <div class="menu-item" id="cm-modify-obj-size">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Sync object size</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-reset-obj-size">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reset object size</div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-edit-multiple-instances">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Edit multiple instances</div>
            </div>
            <div class="menu-item" id="cm-auto-ann-background">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Auto annotate in background</div>
            </div>
            <div class="menu-item" id="cm-interpolate-background">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Interpolate in background</div>
            </div>

            <div class="menu-item" id="cm-show-trajectory">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Show Trajectory</div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-select-as-ref">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Copy/Select as Ref</div>
            </div>

            <div class="menu-item" id="cm-follow-ref">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Follow Ref</div>
            </div>

            <div class="menu-item" id="cm-sync-followers">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Sync followers</div>
            </div>

            <div class="menu-item" id="cm-follow-static-objects">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Follow Static Objects</div>
            </div>

            <div class="menu-item" id="cm-show-all-objs-by-type">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Show all objects of this type</div>
            </div>
          </div>

          <div id="box-editor-context-menu">
            <div class="menu-item" id="cm-select-all">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text"><u>S</u>elect all</div>
            </div>

            <div class="menu-item" id="cm-select-all-previous">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Select all previous</div>
            </div>

            <div class="menu-item" id="cm-select-all-next">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Select all next</div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-delete-empty-boxes">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Delete empty boxes</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-delete">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text"><u>D</u>elete</div>
            </div>

            <div class="menu-item" id="cm-delete-intersected-boxes">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Delete intersected boxes</div>
            </div>

            <div class="menu-item" id="cm-interpolate">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Int<u>e</u>rpolate</div>
            </div>

            <div class="menu-item" id="cm-auto-annotate">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text"><u>A</u>uto annotate</div>
            </div>

            <div class="menu-item" id="cm-auto-annotate-wo-rotation">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Auto annotate (no rotation)</div>
            </div>

            <div class="menu-item" id="cm-fit">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Fit</div>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>
              <div id="cm-fit-submenu">
                <div class="menu-item" id="cm-fit-size">
                  <div class="menu-item-text">Size</div>
                </div>
                <div class="menu-item" id="cm-fit-position">
                  <div class="menu-item-text">Position</div>
                </div>
                <div class="menu-item" id="cm-fit-rotation">
                  <div class="menu-item-text">Rotation</div>
                </div>
                <div class="menu-item" id="cm-fit-moving-direction">
                  <div class="menu-item-text">Moving direction</div>
                </div>
                <div class="menu-item menu-seperator"></div>
                <div class="menu-item" id="cm-fit-top">
                  <div class="menu-item-text">Top</div>
                </div>
                <div class="menu-item" id="cm-fit-bottom">
                  <div class="menu-item-text">Bottom</div>
                </div>
                <div class="menu-item" id="cm-fit-left">
                  <div class="menu-item-text">Left</div>
                </div>
                <div class="menu-item" id="cm-fit-right">
                  <div class="menu-item-text">Right</div>
                </div>
                <div class="menu-item" id="cm-fit-front">
                  <div class="menu-item-text">Front</div>
                </div>
                <div class="menu-item" id="cm-fit-rear">
                  <div class="menu-item-text">Rear</div>
                </div>
              </div>
            </div>

            <div class="menu-item" id="cm-reverse-direction">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reverse heading direction</div>
            </div>

            <div class="menu-item" id="cm-reset-roll-pitch">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reset roll (x) & pitch (y)</div>
            </div>

            <div class="menu-item" id="cm-reset-yaw">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Reset yaw (z)</div>
            </div>

            <div class="menu-item" id="cm-edit-attr">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Edit attributes</div>
            </div>

            <div class="menu-item" id="cm-finalize">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text"><u>F</u>inalize</div>
            </div>

            <div class="menu-item" id="cm-reload">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Reload</div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-goto-this-frame">
              <div class="menu-item-text"><u>G</u>o to this object</div>
            </div>

            <div class="menu-item" id="cm-sync-size">
              <div class="menu-item-text">Sync size to all</div>
            </div>
            <div class="menu-item" id="cm-interpolate-all-others">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Re-interpolate all others</div>
            </div>

            <div class="menu-item" id="cm-reset-size">
              <div class="menu-item-text">Reset size</div>
            </div>

            <div class="menu-item" id="cm-follow-static-objects">
              <div class="menu-item-text">Follow static objects</div>
            </div>

            <!-- <div class="menu-item" id="cm-this">
                <div class="menu-item-icon"></div>
                <div class="menu-item-text">This frame</div>
                <div class="menu-item-arrow menu-item-icon">
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon"><g>
                    <path d="M12 8 L 18 12 L 12 16Z"></path>
                  </g></svg>
                </div>
                <div id="cm-this-submenu">
                  
                </div>
              </div> -->

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cm-show-trajectory">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text"><u>T</u>rajectory</div>
            </div>

            <div class="menu-item" id="cm-check">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">Check</div>
            </div>
          </div>

          <div id="box-editor-manager-context-menu">
            <div class="menu-item" id="cm-increase-box-editor">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">More object instance</div>
            </div>

            <div class="menu-item" id="cm-decrease-box-editor">
              <div class="menu-item-icon"> </div>
              <div class="menu-item-text">less object instance</div>
            </div>
          </div>
        </div>

        <div id="config-wrapper">
          <div id="config-menu" class="non-selectable">
            <div class="menu-nonclickable-item" id="cfg-theme">
              <span>Theme</span>
              <div class="cfg-widget-group">
                <select id="cfg-theme-select" class="cfg-widget">
                  <option value="dark" selected>dark</option>
                  <option value="light" selected>light</option>
                </select>
              </div>
            </div>
            <div class="menu-nonclickable-item" id="cfg-point-size">
              <span>Point size</span>
              <div class="cfg-widget-group">
                <div id="cfg-increase-size" class="menu-button">+</div>
                <div id="cfg-decrease-size" class="menu-button">-</div>
              </div>
            </div>
            <div class="menu-nonclickable-item" id="cfg-point-brightness">
              <span>Point brightness</span>
              <div class="cfg-widget-group">
                <div id="cfg-increase-brightness" class="menu-button">+</div>
                <div id="cfg-decrease-brightness" class="menu-button">-</div>
              </div>
            </div>

            <div class="menu-item" id="cfg-hide-circle-ruler">
              <label for="cfg-hide-circle-ruler-checkbox">
                <div class="cfg-menu-label">Hide circle ruler</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-hide-circle-ruler-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item" id="cfg-hide-box">
              <label for="cfg-hide-box-checkbox">
                <div class="cfg-menu-label">Hide box</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-hide-box-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item" id="cfg-hide-id">
              <label for="cfg-hide-id-checkbox">
                <div class="cfg-menu-label">Hide ID</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-hide-id-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item" id="cfg-hide-category">
              <label for="cfg-hide-category-checkbox">
                <div class="cfg-menu-label">Hide Category</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-hide-category-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-nonclickable-item" id="cfg-color-points">
              <span>Color point</span>
              <div class="cfg-widget-group">
                <select type="checkbox" id="cfg-color-points-select" class="cfg-widget">
                  <option value="mono" selected>mono</option>
                  <option value="intensity" selected>by intensity</option>
                </select>
              </div>
            </div>

            <div class="menu-nonclickable-item" id="cfg-color-object">
              <span>Color objects</span>
              <div class="cfg-widget-group">
                <select id="cfg-color-object-scheme" class="cfg-widget">
                  <option value="category">by category</option>
                  <option value="id">by ID</option>
                  <option value="no">don't color</option>
                </select>
              </div>
            </div>

            <div class="menu-nonclickable-item" id="cfg-menu-batch-mode-inst-number">
              <span>Batch mode max box number</span>
              <div class="cfg-widget-group">
                <select title="instance number" id="cfg-batch-mode-inst-number" class="cfg-widget">
                  <option value="10">10</option>
                  <option value="20" selected>20</option>
                  <option value="30">30</option>
                  <option value="40">40</option>
                </select>
              </div>
            </div>

            <div class="menu-nonclickable-item" id="cfg-coordinate-system">
              <span>Coordinate system</span>
              <div class="cfg-widget-group">
                <select title="coordinate system" id="cfg-coordinate-system-select" class="cfg-widget">
                  <option value="utm">GPS/UTM</option>
                  <option value="lidar" selected>LiDAR</option>
                </select>
              </div>
            </div>

            <div class="menu-nonclickable-item" id="cfg-camera-group-for-context">
              <span>Context camera group</span>
              <div class="cfg-widget-group">
                <select title="coordinate system" id="cfg-camera-group-for-context-select" class="cfg-widget">
                  <option value="camera">camera</option>
                  <option value="aux_camera" selected>aux_camera</option>
                </select>
              </div>
            </div>

            <div class="menu-item" id="cfg-auto-rotate-xy">
              <label for="cfg-auto-rotate-xy-checkbox">
                <div class="cfg-menu-label">Auto rotate X/Y (roll/pitch)</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-auto-rotate-xy-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item" id="cfg-auto-update-interpolated-boxes">
              <label for="cfg-auto-update-interpolated-boxes-checkbox">
                <div class="cfg-menu-label">Auto update interploated boxes</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-auto-update-interpolated-boxes-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item menu-seperator"></div>

            <div class="menu-item" id="cfg-enable-image-annotation">
              <label for="cfg-enable-image-annotation-checkbox">
                <div class="cfg-menu-label">Enable image annotation</div>
              </label>
              <div class="cfg-widget-group">
                <input type="checkbox" id="cfg-enable-image-annotation-checkbox" class="cfg-widget" />
              </div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cfg-data">
              <span>Data settings</span>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>

              <div id="cfg-data-submenu">
                <div class="menu-item" id="cfg-data-preload">
                  <label for="cfg-data-preload-checkbox">
                    <div class="cfg-menu-label">Preload</div>
                  </label>
                  <div class="cfg-widget-group">
                    <input type="checkbox" id="cfg-data-preload-checkbox" class="cfg-widget" />
                  </div>
                  <!-- <div class="cfg-widget-group">
                      
                      </div> -->
                </div>

                <div class="menu-nonclickable-item" id="cfg-max-preload-frames">
                  <span>Preload frames</span>
                  <div class="cfg-widget-group">
                    <input id="cfg-data-preload-frames" size="30" type="number" class="cfg-widget" />
                  </div>
                </div>

                <div class="menu-item" id="cfg-data-aux-lidar">
                  <label for="cfg-data-aux-lidar-checkbox">
                    <div class="cfg-menu-label">Auxiliary LiDAR</div>
                  </label>
                  <div class="cfg-widget-group">
                    <input type="checkbox" id="cfg-data-aux-lidar-checkbox" class="cfg-widget" />
                  </div>
                </div>

                <div class="menu-item" id="cfg-data-aux-camera">
                  <label for="cfg-data-aux-camera-checkbox">
                    <div class="cfg-menu-label">Auxiliary Camera</div>
                  </label>
                  <div class="cfg-widget-group">
                    <input type="checkbox" id="cfg-data-aux-camera-checkbox" class="cfg-widget" />
                  </div>
                </div>

                <div class="menu-item" id="cfg-data-radar">
                  <label for="cfg-data-radar-checkbox">
                    <div class="cfg-menu-label">Radar</div>
                  </label>
                  <div class="cfg-widget-group">
                    <input type="checkbox" id="cfg-data-radar-checkbox" class="cfg-widget" />
                  </div>
                </div>

                <div class="menu-item" id="cfg-data-filter-points">
                  <label for="cfg-data-filter-points-checkbox">
                    <div class="cfg-menu-label">Hide high points</div>
                  </label>
                  <div class="cfg-widget-group">
                    <input type="checkbox" id="cfg-data-filter-points-checkbox" class="cfg-widget" />
                  </div>
                </div>
                <div class="menu-nonclickable-item" id="cfg-z-threshold">
                  <span>z-threshold</span>
                  <div class="cfg-widget-group">
                    <input id="cfg-data-filter-points-z" size="30" type="number" class="cfg-widget" />
                  </div>
                </div>
              </div>
            </div>

            <div class="menu-item" id="cfg-experimental">
              <span>Experimental</span>
              <div class="menu-item-arrow menu-item-icon">
                <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-menu-icon">
                  <g>
                    <path d="M12 8 L 18 12 L 12 16Z" />
                  </g>
                </svg>
              </div>

              <div id="cfg-experimental-submenu">
                <div class="menu-item" id="cfg-calib-camera-LiDAR">
                  <div class="menu-item-text">Camera-LiDAR calibration</div>
                </div>

                <div class="menu-item" id="cfg-crop-scene">
                  <div class="menu-item-text">Crop scene</div>
                </div>
              </div>
            </div>

            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cfg-show-log">
              <span>Show output window</span>
            </div>

            <div class="menu-item" id="cfg-take-screenshot">
              <span>Take screenshot</span>
            </div>

            <div class="menu-item" id="cfg-help">
              <a href="https://github.com/naurril/SUSTechPOINTS/blob/dev-auto-annotate/README_guide.md"
                target="_blank">Help</a>
            </div>
          </div>
        </div>

        <!-- div id="projective-view-context-menu">
            <div class="menu-item menu-seperator"></div>
            <div class="menu-item" id="cm-delete">
              <div class="menu-item-icon"></div>
              <div class="menu-item-text">Delete</div>
            </div>

            <div class="menu-item menu-seperator"></div>				
          </div -->
        <div id="object-track-wrapper" class="popup-window-wrapper">
          <div id="view" class="non-selectable">
            <div id="header">
              <span id="title"> Trajectory </span>

              <div id="buttons">
                <!-- <div id="btn-restore" class="ui-button"  title="restore">
                    <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button"><g>
                      <rect x = 6 y = 6 width=12 height=12></rect>
                    </g></svg>
                  </div>
                  <div id="btn-maximize" class="ui-button"  title="maximize">
                    <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button"><g>
                      <rect x = 4 y = 4 width=16 height=16></rect>
                    </g></svg>
                  </div> -->
                <div id="btn-exit" class="ui-button" title="exit">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            <svg id="object-track-svg" viewbox="0 0 1000 1000" preserveAspectRatio="xMinYMax meet">
              <g id="svg-arrows" />
              <g id="svg-scaler" />
            </svg>
          </div>
        </div>

        <div id="crop-scene-wrapper" class="popup-window-wrapper" tabindex="-1">
          <div id="view">
            <div id="header">
              <span id="title">Crop scene</span>
              <div id="buttons">
                <div id="btn-restore" class="ui-button" title="restore">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <rect x="6" y="6" width="12" height="12" />
                    </g>
                  </svg>
                </div>
                <div id="btn-maximize" class="ui-button" title="maximize">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <rect x="4" y="4" width="16" height="16" />
                    </g>
                  </svg>
                </div>
                <div id="btn-exit" class="ui-button" title="exit">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="content">
              <div>
                <!-- <div><span>scene-id:</span><input id="scene-id" /></div> -->
                <div><span>desc:</span><input id="scene-desc" /></div>
                <div><span>start time:</span><input id="scene-start-time" /></div>
                <div><span>seconds:</span><input id="scene-seconds" /></div>

                <div>
                  <button id="btn-generate">generate</button>
                </div>

                <div id="log"> </div>
              </div>
            </div>
          </div>
        </div>

        <div id="calib-wrapper" class="popup-window-wrapper">
          <div id="view">
            <div id="header">
              <span id="title">Lidar-Camera Calibration</span>
              <div id="buttons">
                <div id="btn-exit" class="ui-button" title="exit">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="content">
              <div>
                <button id="btn-start">start</button>
                <button id="btn-stop">stop</button>
              </div>
              <div>
                <div id="camera"></div>
                <div id="camera-to-lidar">
                  <span>camera to lidar</span><br />
                  <div id="position">
                    <span>position:</span>
                    <span>x:</span><input size="20" type="text" id="x" /> <span>y:</span><input size="20" type="text"
                      id="y" /> <span>z:</span><input size="20" type="text" id="z" />
                  </div>
                  <div id="rotation">
                    <span>rotation:</span>
                    <span>x:</span><input size="20" type="text" id="x" /> <span>y:</span><input size="20" type="text"
                      id="y" /> <span>z:</span><input size="20" type="text" id="z" />
                  </div>
                </div>
                <div id="lidar-to-camera">
                  <span>lidar to camera box (camera rotated, z goes upright, x goes forward)</span><br />
                  <div id="position">
                    <span>position:</span>
                    <span>x:</span><input size="20" type="text" id="x" /> <span>y:</span><input size="20" type="text"
                      id="y" /> <span>z:</span><input size="20" type="text" id="z" />
                  </div>
                  <div id="rotation">
                    <span>rotation:</span>
                    <span>x:</span><input size="20" type="text" id="x" /> <span>y:</span><input size="20" type="text"
                      id="y" /> <span>z:</span><input size="20" type="text" id="z" />
                  </div>
                </div>

                <div>
                  <span>Adjustment Settings</span><button id="btn-apply-settings">Apply</button><br />
                  <span>translate step:</span><input size="20" type="text" id="translate-step" /><br />
                  <span>rotate step:</span><input size="20" type="text" id="rotate-step" /><br />
                </div>
                <div>
                  <label for="calib-proj-pts">project points to image</label><input type="checkbox" id="calib-proj-pts" />
                </div>
                <div>
                  <label for="calib-proj-pts">points opacity</label><button id="btn-inc-opacity">+</button><button
                    id="btn-dec-opacity">-</button>
                </div>
                <div>
                  <label for="calib-proj-pts">points size</label><button id="btn-inc-width">+</button><button
                    id="btn-dec-width">-</button>
                </div>
                <div>
                  <label for="calib-proj-boxes">project boxes to image</label><input type="checkbox"
                    id="calib-proj-boxes" />
                </div>
                <div>
                  <span>calib matrix</span>
                  <div id="calib-matrix"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- <div id="log-wrapper" class="popup-window-wrapper">
          <div id="view">
            <div id="header">
              <span id="title">Output</span>
              <div id="buttons">
                <div id="btn-clear" class="ui-button" title="clear logs">
                  <svg
                    viewBox="0 0 24 24"
                    preserveAspectRatio="xMidYMid meet"
                    focusable="false"
                    class="svg-button"
                  >
                    <g>
                      <circle cx="12" cy="12" r="8" />
                      <polyline points="7 7 17 17" />
                    </g>
                  </svg>
                </div>
                <div id="btn-exit" class="ui-button" title="exit">
                  <svg
                    viewBox="0 0 24 24"
                    preserveAspectRatio="xMidYMid meet"
                    focusable="false"
                    class="svg-button"
                  >
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="tabs">
              <div id="tab-log" class="tab-button tab-selected">Logs</div>
              <div id="tab-error" class="tab-button">Errors</div>
              <div id="tab-object" class="tab-button">Objects</div>
            </div>
            <div id="content">
              <div id="content-logs"> </div>
              <div id="content-errors"> </div>
              <div id="content-objects"> </div>
            </div>
          </div>
        </div> -->

        <div id="info-wrapper" class="popup-window-wrapper" tabindex="-1">
          <div id="view">
            <div id="header">
              <span id="title">Info</span>
              <div id="buttons">
                <div id="btn-restore" class="ui-button" title="restore">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <rect x="6" y="6" width="12" height="12" />
                    </g>
                  </svg>
                </div>
                <div id="btn-maximize" class="ui-button" title="maximize">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <rect x="4" y="4" width="16" height="16" />
                    </g>
                  </svg>
                </div>
                <div id="btn-exit" class="ui-button" title="exit">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="info-content"></div>
            <div id="info-bottom-buttons">
              <button id="btn-no">No</button>
              <button id="btn-yes">Yes</button>
            </div>
          </div>
        </div>

        <div id="multi-class-chooser-wrapper" class="popup-window-wrapper">
          <div id="view">
            <div id="header">
              <span id="title">Info</span>
              <div id="buttons">
                <div id="btn-exit" class="ui-button" title="exit">
                  <!-- <span class="ui-icon ui-icon-trash"></span> -->
                  <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
                    <g>
                      <path d="M4 4 L 20 20 M 20 4 L 4 20" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            <div id="content">
              <div id="classes"></div>
              <div>
                <input type="text" id="attrs" />
              </div>
            </div>
            <div id="bottom-buttons">
              <button id="btn-clear">Clear</button>
              <button id="btn-all">All</button>
              <button id="btn-no">Cancel</button>
              <button id="btn-yes">Yes</button>
            </div>
          </div>
        </div>

        <div id="move-handle-wrapper"> </div>
      </div>
    </template>
    <template id="box-editor-ui-template">
    </template>
    <template id="batch-editor-tools-template">
      <div id="batch-editor-tools-wrapper" class="non-selectable">
        <div id="batch-editor-tools">
          <!-- <select title="category"  id="object-category-selector"></select>
          <input title="tracking id" list="obj-ids-of-scene" id="object-track-id-editor" type="text" size="5"></input> -->

          <div class="menu-button" id="exit">Exit</div>

          <div class="menu-button" id="prev">Previous</div>
          <div class="menu-button" id="next">Next</div>

          <div class="menu-button" id="trajectory">Trajectory</div>
          <div class="menu-button" id="auto-annotate">Auto</div>
          <div class="menu-button" id="auto-annotate-translate-only">Auto (no rotation) </div>
          <div class="menu-button" id="interpolate">Interpolate</div>
          <div class="menu-button" id="reload">Reload</div>
          <div class="menu-button" id="finalize">Finalize</div>

          <!-- <div class="menu-button" id="save">Save</div> -->

          <!-- <div class="ui-button" id="config">
            <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" class="svg-button">
              <g>
                <circle cx = 12 cy=7 r=1 />
                <circle cx = 12 cy=12 r=1 />
                <circle cx = 12 cy=17 r=1 />							
              </g>
            </svg>
          </div> -->
        </div>
      </div>
    </template>
  </template>
</template>
<script setup lang="ts">
import ZView from '../views/ZView.vue'
</script>
