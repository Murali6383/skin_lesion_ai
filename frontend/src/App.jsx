import React, {
  useEffect,
  useRef,
  useState,
} from "react";

const API_URL = "http://127.0.0.1:8001";
const STORAGE_KEY = "skinguardian_chats";

// Streaming UI tuning
const STREAM_UPDATE_INTERVAL = 40;

function App() {
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(
        STORAGE_KEY
      );

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] =
    useState(null);

  const [prompt, setPrompt] = useState("");

  const [image, setImage] = useState(null);

  const [preview, setPreview] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  // Used to safely update streaming message
  const streamBufferRef = useRef("");

  const streamFlushTimerRef =
    useRef(null);

  const streamAssistantIdRef =
    useRef(null);

  const streamChatIdRef =
    useRef(null);

  // =====================================================
  // SAVE CHATS
  // =====================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );
    } catch (error) {
      console.error(
        "Unable to save chats:",
        error
      );
    }
  }, [chats]);

  // =====================================================
  // AUTO SCROLL
  // =====================================================

  useEffect(() => {
    if (!bottomRef.current) {
      return;
    }

    bottomRef.current.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [chats, loading]);

  // =====================================================
  // ACTIVE CHAT
  // =====================================================

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  // =====================================================
  // AUTO RESIZE TEXTAREA
  // =====================================================

  const autoResizeTextarea = (
    element
  ) => {
    if (!element) {
      return;
    }

    element.style.height = "auto";

    const newHeight = Math.min(
      element.scrollHeight,
      180
    );

    element.style.height =
      `${newHeight}px`;
  };

  const handlePromptChange = (
    event
  ) => {
    setPrompt(event.target.value);

    autoResizeTextarea(
      event.target
    );
  };

  const resetTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height =
        "auto";
    }
  };

  // =====================================================
  // NEW CHAT
  // =====================================================

  const createNewChat = () => {
    if (loading) {
      return;
    }

    setActiveChatId(null);
    setPrompt("");
    setImage(null);
    setPreview(null);

    resetTextarea();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =====================================================
  // OPEN CHAT
  // =====================================================

  const openChat = (chatId) => {
    if (loading) {
      return;
    }

    const chat = chats.find(
      (item) => item.id === chatId
    );

    setActiveChatId(chatId);
    setPrompt("");
    setImage(null);

    resetTextarea();

    if (chat?.imageData) {
      setPreview(chat.imageData);
    } else {
      setPreview(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =====================================================
  // DELETE CHAT
  // =====================================================

  const deleteChat = (
    chatId,
    event
  ) => {
    event.stopPropagation();

    if (loading) {
      return;
    }

    setChats((oldChats) =>
      oldChats.filter(
        (chat) =>
          chat.id !== chatId
      )
    );

    if (activeChatId === chatId) {
      setActiveChatId(null);
      setPrompt("");
      setImage(null);
      setPreview(null);
    }
  };

  // =====================================================
  // FILE TO DATA URL
  // =====================================================

  const fileToDataURL = (
    file
  ) => {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = () => {
          resolve(
            reader.result
          );
        };

        reader.onerror =
          reject;

        reader.readAsDataURL(file);
      }
    );
  };

  // =====================================================
  // DATA URL TO FILE
  // =====================================================

  const dataURLToFile = async (
    dataURL,
    filename = "skin_lesion.jpg"
  ) => {
    try {
      const response =
        await fetch(dataURL);

      const blob =
        await response.blob();

      return new File(
        [blob],
        filename,
        {
          type:
            blob.type ||
            "image/jpeg",
        }
      );
    } catch (error) {
      console.error(
        "Image restore error:",
        error
      );

      return null;
    }
  };

  // =====================================================
  // IMAGE UPLOAD
  // =====================================================

  const handleImage = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please select an image."
      );

      return;
    }

    try {
      const dataURL =
        await fileToDataURL(file);

      setImage(file);
      setPreview(dataURL);

      if (activeChatId) {
        setChats((oldChats) =>
          oldChats.map((chat) => {
            if (
              chat.id !==
              activeChatId
            ) {
              return chat;
            }

            return {
              ...chat,

              imageData: dataURL,

              updatedAt:
                new Date().toISOString(),
            };
          })
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Unable to process image."
      );
    }
  };

  // =====================================================
  // REMOVE IMAGE
  // =====================================================

  const removeImage = () => {
    if (loading) {
      return;
    }

    setImage(null);
    setPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  };

  // =====================================================
  // CHAT TITLE
  // =====================================================

  const generateTitle = (
    text
  ) => {
    const cleanText =
      text.trim();

    if (!cleanText) {
      return "Skin Lesion Analysis";
    }

    return cleanText.length > 35
      ? cleanText.substring(
          0,
          35
        ) + "..."
      : cleanText;
  };

  // =====================================================
  // GET SAVED IMAGE
  // =====================================================

  const getImageForChat =
    async (chatId) => {
      if (image) {
        return image;
      }

      const chat = chats.find(
        (item) =>
          item.id === chatId
      );

      if (chat?.imageData) {
        return await dataURLToFile(
          chat.imageData,
          "skin_lesion.jpg"
        );
      }

      if (preview) {
        return await dataURLToFile(
          preview,
          "skin_lesion.jpg"
        );
      }

      return null;
    };

  // =====================================================
  // FLUSH STREAM BUFFER
  // =====================================================

  const flushStreamBuffer = () => {
    const chatId =
      streamChatIdRef.current;

    const assistantId =
      streamAssistantIdRef.current;

    const textToAdd =
      streamBufferRef.current;

    if (
      !chatId ||
      !assistantId ||
      !textToAdd
    ) {
      return;
    }

    streamBufferRef.current =
      "";

    setChats((oldChats) =>
      oldChats.map((chat) => {
        if (
          chat.id !== chatId
        ) {
          return chat;
        }

        return {
          ...chat,

          updatedAt:
            new Date().toISOString(),

          messages:
            chat.messages.map(
              (message) => {
                if (
                  message.id !==
                  assistantId
                ) {
                  return message;
                }

                return {
                  ...message,

                  text:
                    message.text +
                    textToAdd,

                  streaming:
                    true,
                };
              }
            ),
        };
      })
    );
  };

  // =====================================================
  // SCHEDULE STREAM FLUSH
  // =====================================================

  const scheduleStreamFlush =
    () => {
      if (
        streamFlushTimerRef.current
      ) {
        return;
      }

      streamFlushTimerRef.current =
        setTimeout(() => {
          streamFlushTimerRef.current =
            null;

          flushStreamBuffer();
        }, STREAM_UPDATE_INTERVAL);
    };

  // =====================================================
  // FINISH STREAM
  // =====================================================

  const finishStream = () => {
    if (
      streamFlushTimerRef.current
    ) {
      clearTimeout(
        streamFlushTimerRef.current
      );

      streamFlushTimerRef.current =
        null;
    }

    flushStreamBuffer();

    const chatId =
      streamChatIdRef.current;

    const assistantId =
      streamAssistantIdRef.current;

    if (
      chatId &&
      assistantId
    ) {
      setChats((oldChats) =>
        oldChats.map((chat) => {
          if (
            chat.id !== chatId
          ) {
            return chat;
          }

          return {
            ...chat,

            updatedAt:
              new Date().toISOString(),

            messages:
              chat.messages.map(
                (message) => {
                  if (
                    message.id !==
                    assistantId
                  ) {
                    return message;
                  }

                  return {
                    ...message,

                    streaming:
                      false,
                  };
                }
              ),
          };
        })
      );
    }

    streamChatIdRef.current =
      null;

    streamAssistantIdRef.current =
      null;

    streamBufferRef.current =
      "";
  };

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  const sendMessage = async () => {

    // ===================================================
    // IMPORTANT:
    // Prevent duplicate request while response is streaming
    // ===================================================

    if (loading || isStreaming) {
      return;
    }

    const question =
      prompt.trim();

    if (
      !question &&
      !image &&
      !activeChat?.imageData
    ) {
      alert(
        "Please upload a skin lesion image first."
      );

      return;
    }

    const finalQuestion =
      question ||
      "Please analyze this skin lesion image.";

    let chatId =
      activeChatId;

    // ===================================================
    // CREATE NEW CHAT
    // ===================================================

    if (!chatId) {
      chatId =
        Date.now().toString();

      const newChat = {
        id: chatId,

        title:
          generateTitle(
            finalQuestion
          ),

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString(),

        messages: [],

        imageData:
          preview || null,
      };

      setChats((oldChats) => [
        newChat,
        ...oldChats,
      ]);

      setActiveChatId(chatId);
    }

    // ===================================================
    // CURRENT CHAT
    // ===================================================

    const currentChat =
      chats.find(
        (chat) =>
          chat.id === chatId
      );

    const firstMessage =
      !currentChat ||
      currentChat.messages.length ===
        0;

    // ===================================================
    // FIRST MESSAGE NEEDS IMAGE
    // ===================================================

    let imageFile = null;

    if (firstMessage) {
      imageFile =
        await getImageForChat(
          chatId
        );

      if (!imageFile) {
        alert(
          "Please upload a skin lesion image first."
        );

        return;
      }
    }

    // ===================================================
    // USER MESSAGE
    // ===================================================

    const userMessage = {
      id:
        Date.now().toString(),

      role: "user",

      text: finalQuestion,

      image: firstMessage
        ? preview ||
          currentChat?.imageData ||
          null
        : null,

      createdAt:
        new Date().toISOString(),
    };

    // ===================================================
    // ADD USER MESSAGE
    // ===================================================

    setChats((oldChats) =>
      oldChats.map((chat) => {
        if (
          chat.id !== chatId
        ) {
          return chat;
        }

        return {
          ...chat,

          title:
            chat.messages.length ===
            0
              ? generateTitle(
                  finalQuestion
                )
              : chat.title,

          updatedAt:
            new Date().toISOString(),

          imageData:
            chat.imageData ||
            preview ||
            null,

          messages: [
            ...chat.messages,
            userMessage,
          ],
        };
      })
    );

    // ===================================================
    // CLEAR INPUT
    // ===================================================

    setPrompt("");

    resetTextarea();

    // ===================================================
    // START LOADING
    // ===================================================

    setLoading(true);

    try {

      // =================================================
      // FORM DATA
      // =================================================

      const formData =
        new FormData();

      // -------------------------------------------------
      // IMAGE ONLY FOR FIRST MESSAGE
      // -------------------------------------------------

      if (
        firstMessage &&
        imageFile
      ) {
        formData.append(
          "file",
          imageFile
        );
      }

      // -------------------------------------------------
      // QUESTION
      // -------------------------------------------------

      formData.append(
        "prompt",
        finalQuestion
      );

      // -------------------------------------------------
      // FIRST MESSAGE
      // -------------------------------------------------

      formData.append(
        "first_message",
        firstMessage
          ? "true"
          : "false"
      );

      // =================================================
      // FOLLOW-UP
      // =================================================

      if (!firstMessage) {

        /*
         * Use the latest chats state to find
         * the previous prediction.
         */

        const latestChat =
          chats.find(
            (chat) =>
              chat.id === chatId
          );

        const previousAssistantMessage =
          [
            ...(latestChat?.messages ||
              []),
          ]
            .reverse()
            .find(
              (message) =>
                message.role ===
                  "assistant" &&
                message.prediction
            );

        if (
          previousAssistantMessage?.prediction
        ) {

          formData.append(
            "previous_disease",
            previousAssistantMessage
              .prediction.disease
          );

          formData.append(
            "previous_confidence",
            String(
              previousAssistantMessage
                .prediction.confidence
            )
          );
        }
      }

      console.log(
        "================================"
      );

      console.log(
        "Sending message..."
      );

      console.log(
        "Question:",
        finalQuestion
      );

      console.log(
        "First message:",
        firstMessage
      );

      if (imageFile) {
        console.log(
          "Image:",
          imageFile.name
        );
      } else {
        console.log(
          "Follow-up: image not sent"
        );
      }

      console.log(
        "================================"
      );

      // =================================================
      // FETCH
      // =================================================

      const response =
        await fetch(
          `${API_URL}/chat`,
          {
            method: "POST",
            body: formData,
          }
        );

      // =================================================
      // RESPONSE CHECK
      // =================================================

      if (!response.ok) {

        let errorText =
          "Backend request failed.";

        try {

          const errorData =
            await response.json();

          if (
            typeof errorData?.detail ===
            "string"
          ) {
            errorText =
              errorData.detail;

          } else if (
            Array.isArray(
              errorData?.detail
            )
          ) {
            errorText =
              errorData.detail
                .map(
                  (item) =>
                    item.msg ||
                    JSON.stringify(
                      item
                    )
                )
                .join(", ");
          }

        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(
          errorText
        );
      }

      // =================================================
      // STREAM CHECK
      // =================================================

      if (!response.body) {
        throw new Error(
          "Streaming response is not available."
        );
      }

      // =================================================
      // ASSISTANT MESSAGE
      // =================================================

      const assistantId =
        (
          Date.now() + 1
        ).toString();

      const assistantMessage = {
        id: assistantId,

        role: "assistant",

        text: "",

        prediction: null,

        note: null,

        streaming: true,

        createdAt:
          new Date().toISOString(),
      };

      // Save stream references
      streamChatIdRef.current =
        chatId;

      streamAssistantIdRef.current =
        assistantId;

      streamBufferRef.current =
        "";

      // =================================================
      // ADD EMPTY ASSISTANT MESSAGE
      // =================================================

      setChats((oldChats) =>
        oldChats.map((chat) => {
          if (
            chat.id !== chatId
          ) {
            return chat;
          }

          return {
            ...chat,

            updatedAt:
              new Date().toISOString(),

            messages: [
              ...chat.messages,
              assistantMessage,
            ],
          };
        })
      );

      // =================================================
      // STREAM READER
      // =================================================

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder(
          "utf-8"
        );

      let buffer = "";

      let receivedFirstToken =
        false;

      // =================================================
      // READ STREAM
      // =================================================

      while (true) {

        const {
          value,
          done,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        // =================================================
        // PROCESS NDJSON
        // =================================================

        for (
          const line of lines
        ) {

          const cleanLine =
            line.trim();

          if (!cleanLine) {
            continue;
          }

          let event;

          try {

            event =
              JSON.parse(
                cleanLine
              );

          } catch (
            parseError
          ) {

            console.warn(
              "Invalid stream JSON:",
              cleanLine
            );

            continue;
          }

          // =================================================
          // PREDICTION
          // =================================================

          if (
            event.type ===
            "prediction"
          ) {

            setChats(
              (oldChats) =>
                oldChats.map(
                  (chat) => {

                    if (
                      chat.id !==
                      chatId
                    ) {
                      return chat;
                    }

                    return {

                      ...chat,

                      messages:
                        chat.messages.map(
                          (
                            message
                          ) => {

                            if (
                              message.id !==
                              assistantId
                            ) {
                              return message;
                            }

                            return {

                              ...message,

                              prediction:
                                event.prediction_performed
                                  ? {
                                      disease:
                                        event.disease,

                                      confidence:
                                        event.confidence,
                                    }
                                  : null,

                              note:
                                event.prediction_performed
                                  ? "The image classification result is an AI research prediction and not a confirmed medical diagnosis."
                                  : null,
                            };
                          }
                        ),
                    };
                  }
                )
            );
          }

          // =================================================
          // TOKEN
          // =================================================

          if (
            event.type ===
            "token"
          ) {

            const token =
              event.content || "";

            if (!token) {
              continue;
            }

            // ---------------------------------------------
            // FIRST TOKEN
            // ---------------------------------------------

            if (
              !receivedFirstToken
            ) {

              receivedFirstToken =
                true;

              // Hide dots immediately
              setLoading(false);
            }

            // ---------------------------------------------
            // BUFFER TOKEN
            // ---------------------------------------------

            streamBufferRef.current +=
              token;

            scheduleStreamFlush();
          }

          // =================================================
          // DONE
          // =================================================

          if (
            event.type ===
            "done"
          ) {

            finishStream();
          }

          // =================================================
          // ERROR
          // =================================================

          if (
            event.type ===
            "error"
          ) {

            throw new Error(
              event.message ||
                "Groq streaming failed."
            );
          }
        }
      }

      // =================================================
      // FLUSH REMAINING BUFFER
      // =================================================

      finishStream();

    } catch (error) {

      console.error(
        "CHAT ERROR:",
        error
      );

      // Stop pending stream timer
      if (
        streamFlushTimerRef.current
      ) {

        clearTimeout(
          streamFlushTimerRef.current
        );

        streamFlushTimerRef.current =
          null;
      }

      streamBufferRef.current =
        "";

      streamChatIdRef.current =
        null;

      streamAssistantIdRef.current =
        null;

      const errorMessage = {
        id:
          (
            Date.now() + 2
          ).toString(),

        role: "assistant",

        text:
          "❌ Unable to connect to SkinGuardian AI.\n\n" +
          (
            error?.message ||
            String(error)
          ),

        error: true,

        streaming: false,

        createdAt:
          new Date().toISOString(),
      };

      setChats((oldChats) =>
        oldChats.map((chat) => {

          if (
            chat.id !== chatId
          ) {
            return chat;
          }

          return {

            ...chat,

            updatedAt:
              new Date().toISOString(),

            messages: [
              ...chat.messages,
              errorMessage,
            ],
          };
        })
      );

    } finally {

      setLoading(false);

      // Keep image in chat history
      setImage(null);

      if (fileInputRef.current) {

        fileInputRef.current.value =
          "";
      }
    }
  };

  // =====================================================
  // ENTER / SHIFT + ENTER
  // =====================================================

  const handleKeyDown = (
    event
  ) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  };

  // =====================================================
  // SUGGESTION
  // =====================================================

  const useSuggestion = (
    text
  ) => {

    setPrompt(text);

    setTimeout(() => {

      if (
        textareaRef.current
      ) {

        textareaRef.current.focus();

        autoResizeTextarea(
          textareaRef.current
        );
      }

    }, 0);
  };

  // =====================================================
  // MESSAGES
  // =====================================================

  const messages =
    activeChat?.messages || [];

  // =====================================================
  // CHECK STREAMING
  // =====================================================

  const isStreaming =
    messages.some(
      (message) =>
        message.streaming ===
        true
    );

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="app">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            🩺
          </div>

          <div>

            <div className="brand-title">
              SkinGuardian
            </div>

            <div className="brand-subtitle">
              AI Medical Assistant
            </div>

          </div>

        </div>

        <button
          className="new-chat-button"
          onClick={createNewChat}
          disabled={loading}
        >
          <span>＋</span>
          New Chat
        </button>

        <div className="recent-header">

          <span>
            Recent Chats
          </span>

          <span className="chat-count">
            {chats.length}
          </span>

        </div>

        <div className="chat-history">

          {chats.length === 0 ? (

            <div className="no-chats">

              <div className="no-chats-icon">
                💬
              </div>

              <p>
                No previous chats
              </p>

              <small>
                Your conversations
                will appear here.
              </small>

            </div>

          ) : (

            chats.map((chat) => (

              <div
                key={chat.id}
                className={`history-item ${
                  activeChatId ===
                  chat.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  openChat(chat.id)
                }
              >

                <div className="history-icon">
                  💬
                </div>

                <div className="history-text">

                  <div className="history-title">
                    {chat.title}
                  </div>

                  <div className="history-date">
                    {new Date(
                      chat.updatedAt
                    ).toLocaleDateString()}
                  </div>

                </div>

                <button
                  className="delete-chat"
                  onClick={(event) =>
                    deleteChat(
                      chat.id,
                      event
                    )
                  }
                  disabled={loading}
                >
                  🗑
                </button>

              </div>

            ))

          )}

        </div>

        <div className="sidebar-bottom">

          <div className="ai-info">
            🧠
            <span>
              Skin Lesion AI
            </span>
          </div>

          <div className="ai-info">
            ⚡
            <span>
              Groq GPT-OSS-20B
            </span>
          </div>

          <div className="online-status">

            <span></span>

            AI Online

          </div>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="main">

        {/* HEADER */}

        <header className="header">

          <div className="header-left">

            <div className="mobile-logo">
              🩺
            </div>

            <div>

              <div className="header-title">

                {activeChat
                  ? activeChat.title
                  : "SkinGuardian AI"}

              </div>

              <div className="header-status">

                <span>
                  ●
                </span>

                AI Assistant Online

              </div>

            </div>

          </div>

          <button
            className="header-new-chat"
            onClick={createNewChat}
            disabled={loading}
          >
            ＋ New Chat
          </button>

        </header>

        {/* ==================================================
            CHAT AREA
        ================================================== */}

        <section className="chat-area">

          {!activeChat ? (

            <div className="welcome">

              <div className="welcome-icon">
                🩺
              </div>

              <h1>
                How can I help you?
              </h1>

              <p>
                Upload a skin lesion
                image and ask
                SkinGuardian AI about it.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    useSuggestion(
                      "What disease is this?"
                    )
                  }
                >

                  🔍

                  <div>

                    <b>
                      What disease is this?
                    </b>

                    <small>
                      Analyze the skin lesion
                    </small>

                  </div>

                </button>

                <button
                  onClick={() =>
                    useSuggestion(
                      "What symptoms should I watch for?"
                    )
                  }
                >

                  ⚠️

                  <div>

                    <b>
                      What symptoms should I watch for?
                    </b>

                    <small>
                      Learn about warning signs
                    </small>

                  </div>

                </button>

                <button
                  onClick={() =>
                    useSuggestion(
                      "What safety precautions should I follow?"
                    )
                  }
                >

                  🛡️

                  <div>

                    <b>
                      What safety precautions should I follow?
                    </b>

                    <small>
                      Get general safety information
                    </small>

                  </div>

                </button>

                <button
                  onClick={() =>
                    useSuggestion(
                      "When should I see a dermatologist?"
                    )
                  }
                >

                  👨‍⚕️

                  <div>

                    <b>
                      When should I see a dermatologist?
                    </b>

                    <small>
                      Know when to seek professional care
                    </small>

                  </div>

                </button>

              </div>

            </div>

          ) : (

            <div className="messages">

              {messages.map(
                (message) => (

                  <div
                    className={`message-row ${
                      message.role
                    }`}
                    key={message.id}
                  >

                    <div className="avatar">

                      {message.role ===
                      "user"
                        ? "👤"
                        : "🤖"}

                    </div>

                    <div className="message-body">

                      <div className="message-name">

                        {message.role ===
                        "user"
                          ? "You"
                          : "SkinGuardian AI"}

                      </div>

                      {/* IMAGE */}

                      {message.image && (

                        <img
                          src={
                            message.image
                          }
                          className="chat-image"
                          alt="Skin lesion"
                        />

                      )}

                      {/* PREDICTION CARD */}

                      {message.prediction && (

                        <div className="prediction-card">

                          <div className="prediction-header">
                            🧠 Skin AI Prediction
                          </div>

                          <div className="prediction-grid">

                            <div className="prediction-item">

                              <span>
                                Predicted Condition
                              </span>

                              <strong>
                                {
                                  message
                                    .prediction
                                    .disease
                                }
                              </strong>

                            </div>

                            <div className="prediction-item">

                              <span>
                                Confidence
                              </span>

                              <strong>
                                {
                                  message
                                    .prediction
                                    .confidence
                                }%
                              </strong>

                            </div>

                          </div>

                        </div>

                      )}

                      {/* AI RESPONSE */}

                      <div
                        className={`message-text ${
                          message.error
                            ? "error"
                            : ""
                        }`}
                      >

                        {message.text}

                        {message.streaming && (

                          <span className="streaming-cursor">
                            ▌
                          </span>

                        )}

                      </div>

                      {/* MEDICAL NOTE */}

                      {message.note && (

                        <div className="medical-note">

                          ⚠️{" "}
                          {message.note}

                        </div>

                      )}

                    </div>

                  </div>

                )
              )}

              {/* DOT LOADING */}

              {loading &&
                !isStreaming && (

                  <div className="message-row assistant">

                    <div className="avatar">
                      🤖
                    </div>

                    <div className="message-body">

                      <div className="message-name">
                        SkinGuardian AI
                      </div>

                      <div className="typing">

                        <span></span>
                        <span></span>
                        <span></span>

                      </div>

                    </div>

                  </div>

                )}

              <div
                ref={bottomRef}
              ></div>

            </div>

          )}

        </section>

        {/* ==================================================
            INPUT
        ================================================== */}

        <div className="input-section">

          {/* IMAGE PREVIEW */}

          {preview && (

            <div className="preview-wrapper">

              <div className="preview-card">

                <img
                  src={preview}
                  alt="Selected lesion"
                />

                <button
                  className="remove-image"
                  onClick={
                    removeImage
                  }
                  disabled={loading}
                >
                  ×
                </button>

              </div>

            </div>

          )}

          {/* INPUT BOX */}

          <div className="input-box">

            <button
              className="attach-button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              title="Upload image"
              disabled={loading}
            >
              📎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.bmp,.webp"
              onChange={handleImage}
              hidden
            />

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={
                handlePromptChange
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder={
                activeChat?.imageData
                  ? "Ask about this skin lesion..."
                  : "Upload an image and ask SkinGuardian AI..."
              }
              rows={1}
              disabled={loading}
            />

            <button
              className="send-button"
              onClick={
                sendMessage
              }
              disabled={
                loading ||
                (
                  !image &&
                  !activeChat?.imageData &&
                  !prompt.trim()
                )
              }
              title="Send"
            >
              ➤
            </button>

          </div>

          <div className="input-hint">
            Enter to send • Shift + Enter
            for new line
          </div>

          <div className="disclaimer">
            SkinGuardian AI provides
            research-oriented information
            and is not a substitute for
            professional medical diagnosis.
          </div>

        </div>

      </main>

    </div>
  );
}

export default App;
