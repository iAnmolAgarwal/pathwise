# Cross-domain candidates — pooled Coursera skill pairs outside the authored prerequisite closure

Produced by `python pipeline/pool.py run`. These pairs are kept in `edges_coursera.json` (they reach `skill_edges.json` as `candidate` edges like every other mined-only pair) but are listed here separately because neither skill is an authored prerequisite of the other, directly or transitively: this is where coincidence chains surface (learners who took two unrelated specializations in a row). They are inspected, not dropped; promotion follows the §15.6 policy and a human tick like any other candidate.

- Caveat on every number: Coursera learners 2015–2020; sequences reconstructed from review order; pseudo-users by reviewer name
- Candidates: 471 of 577 pooled edges

| from | to | support | reverse | conf | n | course pairs | top course pair |
|---|---|---|---|---|---|---|---|
| Deep Learning | Model Evaluation | 5065 | 2831 | 0.641 | 7896 | 16 | Neural Networks and Deep Learning → Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization (1928) |
| Neural Networks | Model Evaluation | 4874 | 443 | 0.917 | 5317 | 6 | Neural Networks and Deep Learning → Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization (1928) |
| Python | Working with APIs | 4657 | 912 | 0.836 | 5569 | 10 | Python Data Structures → Using Python to Access Web Data (1592) |
| Python | Regular Expressions | 2719 | 690 | 0.798 | 3409 | 4 | Python Data Structures → Using Python to Access Web Data (1592) |
| Python | Networking & How the Web Works | 2658 | 700 | 0.792 | 3358 | 5 | Python Data Structures → Using Python to Access Web Data (1592) |
| Data Structures | Working with APIs | 2434 | 213 | 0.920 | 2647 | 3 | Python Data Structures → Using Python to Access Web Data (1592) |
| Python | Data Structures | 2255 | 2243 | 0.501 | 4498 | 6 | Programming for Everybody (Getting Started with Python) → Python Data Structures (1867) |
| Python | SQL | 2098 | 178 | 0.922 | 2276 | 5 | Using Python to Access Web Data → Using Databases with Python (831) |
| Python | Object-Oriented Programming | 1984 | 224 | 0.899 | 2208 | 5 | Using Python to Access Web Data → Using Databases with Python (831) |
| Python | Data Modeling | 1952 | 177 | 0.917 | 2129 | 3 | Using Python to Access Web Data → Using Databases with Python (831) |
| Model Evaluation | Natural Language Processing | 1790 | 109 | 0.943 | 1899 | 7 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Sequence Models (804) |
| Google Cloud Fundamentals | Cloud Networking | 1710 | 1468 | 0.538 | 3178 | 10 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Data Structures | Networking & How the Web Works | 1630 | 153 | 0.914 | 1783 | 2 | Python Data Structures → Using Python to Access Web Data (1592) |
| Data Structures | Regular Expressions | 1592 | 148 | 0.915 | 1740 | 1 | Python Data Structures → Using Python to Access Web Data (1592) |
| TensorFlow & Keras | Model Evaluation | 1537 | 564 | 0.732 | 2101 | 8 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Structuring Machine Learning Projects (1477) |
| Networking & How the Web Works | Command Line & Linux Basics | 1369 | 518 | 0.725 | 1887 | 3 | Technical Support Fundamentals → Operating Systems and You: Becoming a Power User (678) |
| Networking & How the Web Works | Linux Administration | 1369 | 518 | 0.725 | 1887 | 3 | Technical Support Fundamentals → Operating Systems and You: Becoming a Power User (678) |
| TensorFlow & Keras | Natural Language Processing | 1274 | 226 | 0.849 | 1500 | 8 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Sequence Models (804) |
| Python for Data Analysis | Model Evaluation | 1224 | 339 | 0.783 | 1563 | 8 | Python for Data Science and AI → Data Analysis with Python (313) |
| Cloud Storage | Cloud Networking | 1208 | 985 | 0.551 | 2193 | 9 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Cloud Storage | Google Cloud Fundamentals | 1189 | 1097 | 0.520 | 2286 | 9 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Identity & Access Management | Cloud Networking | 1183 | 557 | 0.680 | 1740 | 7 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Identity & Access Management | Google Cloud Fundamentals | 1157 | 567 | 0.671 | 1724 | 5 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Working with APIs | Data Visualization | 1136 | 314 | 0.783 | 1450 | 9 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Data Structures | Data Visualization | 1025 | 62 | 0.943 | 1087 | 4 | Python Data Structures → Capstone: Retrieving, Processing, and Visualizing Data with Python (361) |
| Working with APIs | SQL | 979 | 145 | 0.871 | 1124 | 4 | Using Python to Access Web Data → Using Databases with Python (831) |
| Programming Basics | Networking & How the Web Works | 953 | 157 | 0.859 | 1110 | 2 | Programming for Everybody (Getting Started with Python) → Using Python to Access Web Data (913) |
| Kubernetes | Google Cloud Fundamentals | 948 | 102 | 0.903 | 1050 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Prompt Engineering | Google Cloud Fundamentals | 948 | 102 | 0.903 | 1050 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Python for Data Analysis | Supervised Learning | 910 | 224 | 0.802 | 1134 | 8 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Computer Vision | TensorFlow & Keras | 904 | 749 | 0.547 | 1653 | 7 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Convolutional Neural Networks in TensorFlow (303) |
| Kubernetes | Cloud Networking | 872 | 85 | 0.911 | 957 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Prompt Engineering | Cloud Networking | 872 | 85 | 0.911 | 957 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Foundation (444) |
| Networking & How the Web Works | SQL | 855 | 58 | 0.936 | 913 | 2 | Using Python to Access Web Data → Using Databases with Python (831) |
| Regular Expressions | Working with APIs | 855 | 58 | 0.936 | 913 | 2 | Using Python to Access Web Data → Using Databases with Python (831) |
| Regular Expressions | SQL | 855 | 58 | 0.936 | 913 | 2 | Using Python to Access Web Data → Using Databases with Python (831) |
| Working with APIs | Data Cleaning | 851 | 163 | 0.839 | 1014 | 5 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Data Structures | SQL | 842 | 65 | 0.928 | 907 | 2 | Python Data Structures → Using Databases with Python (720) |
| Networking & How the Web Works | Object-Oriented Programming | 836 | 96 | 0.897 | 932 | 2 | Using Python to Access Web Data → Using Databases with Python (831) |
| Working with APIs | Object-Oriented Programming | 832 | 180 | 0.822 | 1012 | 2 | Using Python to Access Web Data → Using Databases with Python (831) |
| Working with APIs | Data Modeling | 831 | 58 | 0.935 | 889 | 1 | Using Python to Access Web Data → Using Databases with Python (831) |
| Networking & How the Web Works | Data Modeling | 831 | 58 | 0.935 | 889 | 1 | Using Python to Access Web Data → Using Databases with Python (831) |
| Regular Expressions | Data Modeling | 831 | 58 | 0.935 | 889 | 1 | Using Python to Access Web Data → Using Databases with Python (831) |
| Regular Expressions | Object-Oriented Programming | 831 | 58 | 0.935 | 889 | 1 | Using Python to Access Web Data → Using Databases with Python (831) |
| Data Structures | Data Cleaning | 796 | 47 | 0.944 | 843 | 3 | Python Data Structures → Capstone: Retrieving, Processing, and Visualizing Data with Python (361) |
| Data Visualization | scikit-learn | 793 | 526 | 0.601 | 1319 | 8 | Data Analysis with Python → Machine Learning with Python (195) |
| Data Visualization | Model Evaluation | 790 | 501 | 0.612 | 1291 | 7 | Data Analysis with Python → Machine Learning with Python (195) |
| Data Visualization | Supervised Learning | 758 | 192 | 0.798 | 950 | 7 | Data Analysis with Python → Machine Learning with Python (195) |
| Command Line & Linux Basics | Identity & Access Management | 741 | 184 | 0.801 | 925 | 3 | Operating Systems and You: Becoming a Power User → System Administration and IT Infrastructure Services (396) |
| Linux Administration | Identity & Access Management | 741 | 184 | 0.801 | 925 | 3 | Operating Systems and You: Becoming a Power User → System Administration and IT Infrastructure Services (396) |
| Collaborative Git Workflows | Python for Data Analysis | 735 | 50 | 0.936 | 785 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Python for Data Analysis | 735 | 50 | 0.936 | 785 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Data Structures | Object-Oriented Programming | 722 | 95 | 0.884 | 817 | 2 | Python Data Structures → Using Databases with Python (720) |
| Data Structures | Data Modeling | 720 | 64 | 0.918 | 784 | 1 | Python Data Structures → Using Databases with Python (720) |
| Model Evaluation | Computer Vision | 707 | 87 | 0.890 | 794 | 6 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Convolutional Neural Networks (290) |
| Git & Version Control | Debugging | 690 | 101 | 0.872 | 791 | 2 | The Data Scientist’s Toolbox → R Programming (637) |
| Object-Oriented Programming | Data Visualization | 688 | 48 | 0.935 | 736 | 4 | Python for Data Science and AI → Data Analysis with Python (313) |
| Python for Data Analysis | Machine Learning Fundamentals | 677 | 219 | 0.756 | 896 | 6 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Python for Data Analysis | Unsupervised Learning | 674 | 194 | 0.776 | 868 | 5 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Working with APIs | Model Evaluation | 658 | 293 | 0.692 | 951 | 7 | Python for Data Science and AI → Data Analysis with Python (313) |
| Working with APIs | scikit-learn | 654 | 267 | 0.710 | 921 | 6 | Python for Data Science and AI → Data Analysis with Python (313) |
| Data Cleaning | Data Visualization | 654 | 292 | 0.691 | 946 | 4 | Introduction to Data Science in Python → Applied Plotting, Charting & Data Representation in Python (315) |
| R Programming | Debugging | 637 | 98 | 0.867 | 735 | 1 | The Data Scientist’s Toolbox → R Programming (637) |
| Git & Version Control | R Programming | 637 | 98 | 0.867 | 735 | 1 | The Data Scientist’s Toolbox → R Programming (637) |
| Data Structures | Model Evaluation | 623 | 81 | 0.885 | 704 | 4 | Python for Data Science and AI → Data Analysis with Python (313) |
| Object-Oriented Programming | Model Evaluation | 623 | 81 | 0.885 | 704 | 4 | Python for Data Science and AI → Data Analysis with Python (313) |
| Data Structures | scikit-learn | 619 | 55 | 0.918 | 674 | 3 | Python for Data Science and AI → Data Analysis with Python (313) |
| Object-Oriented Programming | scikit-learn | 619 | 55 | 0.918 | 674 | 3 | Python for Data Science and AI → Data Analysis with Python (313) |
| Google Cloud Fundamentals | Infrastructure as Code | 611 | 24 | 0.962 | 635 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| Data Cleaning | Model Evaluation | 602 | 291 | 0.674 | 893 | 5 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Data Cleaning | scikit-learn | 601 | 258 | 0.700 | 859 | 4 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Data Cleaning | Supervised Learning | 597 | 147 | 0.802 | 744 | 4 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Cloud Fundamentals | Identity & Access Management | 588 | 161 | 0.785 | 749 | 3 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Identity & Access Management | Cloud Storage | 571 | 306 | 0.651 | 877 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Collaborative Git Workflows | Data Visualization | 555 | 26 | 0.955 | 581 | 3 | Tools for Data Science → Data Analysis with Python (237) |
| Git & Version Control | Data Visualization | 555 | 26 | 0.955 | 581 | 3 | Tools for Data Science → Data Analysis with Python (237) |
| Git & Version Control | scikit-learn | 550 | 57 | 0.906 | 607 | 5 | Tools for Data Science → Data Analysis with Python (237) |
| Git & Version Control | Model Evaluation | 546 | 32 | 0.945 | 578 | 4 | Tools for Data Science → Data Analysis with Python (237) |
| Spreadsheets | Data Cleaning | 532 | 16 | 0.971 | 548 | 3 | Excel Skills for Business: Essentials → Excel Skills for Business: Advanced (187) |
| Spreadsheets | Data Visualization | 532 | 16 | 0.971 | 548 | 3 | Excel Skills for Business: Essentials → Excel Skills for Business: Advanced (187) |
| Google Cloud Fundamentals | Cloud Architecture | 530 | 32 | 0.943 | 562 | 4 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Google Cloud Fundamentals | Cloud Security | 530 | 32 | 0.943 | 562 | 4 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Google Cloud Fundamentals | Microservices | 530 | 32 | 0.943 | 562 | 4 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Google Cloud Fundamentals | Site Reliability Engineering | 530 | 32 | 0.943 | 562 | 4 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Programming Basics | SQL | 523 | 56 | 0.903 | 579 | 2 | Programming for Everybody (Getting Started with Python) → Using Databases with Python (401) |
| Collaborative Git Workflows | scikit-learn | 522 | 53 | 0.908 | 575 | 4 | Tools for Data Science → Data Analysis with Python (237) |
| Collaborative Git Workflows | Model Evaluation | 518 | 28 | 0.949 | 546 | 3 | Tools for Data Science → Data Analysis with Python (237) |
| Data Visualization | Machine Learning Fundamentals | 517 | 187 | 0.734 | 704 | 5 | Data Analysis with Python → Machine Learning with Python (195) |
| Data Visualization | Unsupervised Learning | 514 | 162 | 0.760 | 676 | 4 | Data Analysis with Python → Machine Learning with Python (195) |
| Computer Vision | Natural Language Processing | 511 | 44 | 0.921 | 555 | 4 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Natural Language Processing in TensorFlow (186) |
| Collaborative Git Workflows | Working with APIs | 498 | 37 | 0.931 | 535 | 2 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Working with APIs | 498 | 37 | 0.931 | 535 | 2 | Tools for Data Science → Python for Data Science and AI (395) |
| Data Cleaning | Machine Learning Fundamentals | 486 | 143 | 0.773 | 629 | 3 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Data Cleaning | Unsupervised Learning | 486 | 143 | 0.773 | 629 | 3 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Cloud Networking | Monitoring & Observability | 472 | 311 | 0.603 | 783 | 4 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Google Cloud Fundamentals | Monitoring & Observability | 465 | 209 | 0.690 | 674 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Working with APIs | Python for Data Analysis | 464 | 263 | 0.638 | 727 | 4 | Python for Data Science and AI → Data Analysis with Python (313) |
| Working with APIs | Exploratory Data Analysis | 463 | 141 | 0.767 | 604 | 4 | Python for Data Science and AI → Data Analysis with Python (313) |
| Cloud Networking | Infrastructure as Code | 454 | 126 | 0.783 | 580 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| Model Evaluation | Data Storytelling | 454 | 341 | 0.571 | 795 | 5 | Data Analysis with Python → Data Visualization with Python (223) |
| scikit-learn | Data Storytelling | 454 | 341 | 0.571 | 795 | 5 | Data Analysis with Python → Data Visualization with Python (223) |
| Networking & How the Web Works | Data Visualization | 443 | 25 | 0.947 | 468 | 3 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Regular Expressions | Data Visualization | 443 | 25 | 0.947 | 468 | 3 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Model Evaluation | scikit-learn | 441 | 441 | 0.500 | 882 | 3 | Data Analysis with Python → Machine Learning with Python (195) |
| Kubernetes | Cloud Storage | 440 | 41 | 0.915 | 481 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Prompt Engineering | Cloud Storage | 440 | 41 | 0.915 | 481 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Data Structures | Exploratory Data Analysis | 435 | 30 | 0.935 | 465 | 2 | Python for Data Science and AI → Data Analysis with Python (313) |
| Data Structures | Python for Data Analysis | 435 | 30 | 0.935 | 465 | 2 | Python for Data Science and AI → Data Analysis with Python (313) |
| Object-Oriented Programming | Data Cleaning | 435 | 30 | 0.935 | 465 | 2 | Python for Data Science and AI → Data Analysis with Python (313) |
| Object-Oriented Programming | Exploratory Data Analysis | 435 | 30 | 0.935 | 465 | 2 | Python for Data Science and AI → Data Analysis with Python (313) |
| Object-Oriented Programming | Python for Data Analysis | 435 | 30 | 0.935 | 465 | 2 | Python for Data Science and AI → Data Analysis with Python (313) |
| Collaborative Git Workflows | Programming Basics | 433 | 168 | 0.720 | 601 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Collaborative Git Workflows | Python | 433 | 168 | 0.720 | 601 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Programming Basics | 433 | 168 | 0.720 | 601 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Python | 433 | 168 | 0.720 | 601 | 3 | Tools for Data Science → Python for Data Science and AI (395) |
| Cloud Networking | Cloud Security | 428 | 25 | 0.945 | 453 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Networking | Microservices | 428 | 25 | 0.945 | 453 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Networking | Site Reliability Engineering | 428 | 25 | 0.945 | 453 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Supervised Learning | Deep Learning | 415 | 246 | 0.628 | 661 | 11 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Networking & How the Web Works | Data Cleaning | 412 | 22 | 0.949 | 434 | 2 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Regular Expressions | Data Cleaning | 412 | 22 | 0.949 | 434 | 2 | Using Python to Access Web Data → Capstone: Retrieving, Processing, and Visualizing Data with Python (388) |
| Cloud Storage | Infrastructure as Code | 411 | 126 | 0.765 | 537 | 3 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| Supervised Learning | TensorFlow & Keras | 410 | 123 | 0.769 | 533 | 8 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Working with APIs | Data Storytelling | 407 | 149 | 0.732 | 556 | 5 | Python for Data Science and AI → Data Visualization with Python (229) |
| Identity & Access Management | Infrastructure as Code | 407 | 20 | 0.953 | 427 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| Programming Basics | Data Modeling | 401 | 55 | 0.879 | 456 | 1 | Programming for Everybody (Getting Started with Python) → Using Databases with Python (401) |
| TensorFlow & Keras | Time Series Analysis | 398 | 32 | 0.926 | 430 | 4 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Sequences, Time Series and Prediction (141) |
| Command Line & Linux Basics | Cloud Fundamentals | 396 | 53 | 0.882 | 449 | 1 | Operating Systems and You: Becoming a Power User → System Administration and IT Infrastructure Services (396) |
| Linux Administration | Cloud Fundamentals | 396 | 53 | 0.882 | 449 | 1 | Operating Systems and You: Becoming a Power User → System Administration and IT Infrastructure Services (396) |
| Collaborative Git Workflows | Data Structures | 395 | 36 | 0.916 | 431 | 1 | Tools for Data Science → Python for Data Science and AI (395) |
| Collaborative Git Workflows | Object-Oriented Programming | 395 | 36 | 0.916 | 431 | 1 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Data Structures | 395 | 36 | 0.916 | 431 | 1 | Tools for Data Science → Python for Data Science and AI (395) |
| Git & Version Control | Object-Oriented Programming | 395 | 36 | 0.916 | 431 | 1 | Tools for Data Science → Python for Data Science and AI (395) |
| Feature Engineering | TensorFlow & Keras | 374 | 117 | 0.762 | 491 | 7 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| scikit-learn | TensorFlow & Keras | 371 | 53 | 0.875 | 424 | 5 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Collaborative Git Workflows | SQL | 368 | 15 | 0.961 | 383 | 2 | Tools for Data Science → Databases and SQL for Data Science (265) |
| Git & Version Control | SQL | 368 | 15 | 0.961 | 383 | 2 | Tools for Data Science → Databases and SQL for Data Science (265) |
| Data Structures | Data Storytelling | 351 | 16 | 0.956 | 367 | 2 | Python for Data Science and AI → Data Visualization with Python (229) |
| Object-Oriented Programming | Data Storytelling | 351 | 16 | 0.956 | 367 | 2 | Python for Data Science and AI → Data Visualization with Python (229) |
| Command Line & Linux Basics | Network Security | 345 | 131 | 0.725 | 476 | 2 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Command Line & Linux Basics | Security Fundamentals | 345 | 131 | 0.725 | 476 | 2 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Linux Administration | Network Security | 345 | 131 | 0.725 | 476 | 2 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Linux Administration | Security Fundamentals | 345 | 131 | 0.725 | 476 | 2 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Working with APIs | Supervised Learning | 341 | 153 | 0.690 | 494 | 5 | Python for Data Science and AI → Machine Learning with Python (184) |
| Collaborative Git Workflows | Data Cleaning | 340 | 14 | 0.960 | 354 | 2 | Tools for Data Science → Data Analysis with Python (237) |
| Collaborative Git Workflows | Exploratory Data Analysis | 340 | 14 | 0.960 | 354 | 2 | Tools for Data Science → Data Analysis with Python (237) |
| Git & Version Control | Data Cleaning | 340 | 14 | 0.960 | 354 | 2 | Tools for Data Science → Data Analysis with Python (237) |
| Git & Version Control | Exploratory Data Analysis | 340 | 14 | 0.960 | 354 | 2 | Tools for Data Science → Data Analysis with Python (237) |
| Exploratory Data Analysis | Data Visualization | 339 | 276 | 0.551 | 615 | 3 | Data Analysis with Python → Data Visualization with Python (223) |
| Command Line & Linux Basics | Cryptography Basics | 338 | 27 | 0.926 | 365 | 1 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Linux Administration | Cryptography Basics | 338 | 27 | 0.926 | 365 | 1 | Operating Systems and You: Becoming a Power User → IT Security: Defense against the digital dark arts (338) |
| Data Cleaning | Data Storytelling | 335 | 165 | 0.670 | 500 | 3 | Data Analysis with Python → Data Visualization with Python (223) |
| Exploratory Data Analysis | Data Storytelling | 335 | 165 | 0.670 | 500 | 3 | Data Analysis with Python → Data Visualization with Python (223) |
| Cloud Fundamentals | Network Security | 330 | 132 | 0.714 | 462 | 2 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Cloud Fundamentals | Security Fundamentals | 330 | 132 | 0.714 | 462 | 2 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Cloud Fundamentals | Cryptography Basics | 323 | 28 | 0.920 | 351 | 1 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Identity & Access Management | Cryptography Basics | 323 | 28 | 0.920 | 351 | 1 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Identity & Access Management | Network Security | 323 | 28 | 0.920 | 351 | 1 | System Administration and IT Infrastructure Services → IT Security: Defense against the digital dark arts (323) |
| Collaborative Git Workflows | Data Storytelling | 318 | 13 | 0.961 | 331 | 2 | Tools for Data Science → Data Visualization with Python (215) |
| Git & Version Control | Data Storytelling | 318 | 13 | 0.961 | 331 | 2 | Tools for Data Science → Data Visualization with Python (215) |
| Exploratory Data Analysis | Model Evaluation | 317 | 239 | 0.570 | 556 | 3 | Data Analysis with Python → Machine Learning with Python (195) |
| Exploratory Data Analysis | scikit-learn | 317 | 239 | 0.570 | 556 | 3 | Data Analysis with Python → Machine Learning with Python (195) |
| Feature Engineering | Deep Learning | 317 | 233 | 0.576 | 550 | 9 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Inferential Statistics | Data Visualization | 315 | 16 | 0.952 | 331 | 1 | Introduction to Data Science in Python → Applied Plotting, Charting & Data Representation in Python (315) |
| Exploratory Data Analysis | Supervised Learning | 313 | 128 | 0.710 | 441 | 3 | Data Analysis with Python → Machine Learning with Python (195) |
| Git & Version Control | Supervised Learning | 313 | 44 | 0.877 | 357 | 4 | Tools for Data Science → Machine Learning with Python (178) |
| Data Structures | Supervised Learning | 310 | 52 | 0.856 | 362 | 3 | Python for Data Science and AI → Machine Learning with Python (184) |
| Object-Oriented Programming | Supervised Learning | 310 | 52 | 0.856 | 362 | 3 | Python for Data Science and AI → Machine Learning with Python (184) |
| scikit-learn | Deep Learning | 310 | 47 | 0.868 | 357 | 4 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Data Storytelling | Supervised Learning | 306 | 120 | 0.718 | 426 | 3 | Data Visualization with Python → Machine Learning with Python (169) |
| Supervised Learning | Computer Vision | 300 | 98 | 0.754 | 398 | 6 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Deep Learning | Time Series Analysis | 297 | 25 | 0.922 | 322 | 3 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Sequences, Time Series and Prediction (141) |
| Inferential Statistics | Feature Engineering | 287 | 44 | 0.867 | 331 | 2 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Inferential Statistics | Machine Learning Fundamentals | 287 | 44 | 0.867 | 331 | 2 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Inferential Statistics | scikit-learn | 287 | 44 | 0.867 | 331 | 2 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Inferential Statistics | Supervised Learning | 287 | 44 | 0.867 | 331 | 2 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Collaborative Git Workflows | Supervised Learning | 285 | 40 | 0.877 | 325 | 3 | Tools for Data Science → Machine Learning with Python (178) |
| Cloud Storage | Cloud Architecture | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Storage | Cloud Security | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Storage | Microservices | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Storage | Site Reliability Engineering | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Data Cleaning | Feature Engineering | 284 | 19 | 0.937 | 303 | 1 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Identity & Access Management | Cloud Architecture | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Identity & Access Management | Cloud Security | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Identity & Access Management | Microservices | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Identity & Access Management | Site Reliability Engineering | 284 | 19 | 0.937 | 303 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Inferential Statistics | Unsupervised Learning | 284 | 19 | 0.937 | 303 | 1 | Introduction to Data Science in Python → Applied Machine Learning in Python (284) |
| Debugging | Python | 275 | 89 | 0.755 | 364 | 4 | Python Basics → Python Functions, Files, and Dictionaries (191) |
| Supervised Learning | Neural Networks | 272 | 165 | 0.622 | 437 | 7 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| SQL | Data Visualization | 271 | 270 | 0.501 | 541 | 5 | Databases and SQL for Data Science → Data Visualization with Python (156) |
| Debugging | Data Structures | 267 | 17 | 0.940 | 284 | 3 | Python Basics → Python Functions, Files, and Dictionaries (191) |
| Cloud Storage | Monitoring & Observability | 265 | 131 | 0.669 | 396 | 2 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Collaborative Git Workflows | Advanced SQL | 265 | 14 | 0.950 | 279 | 1 | Tools for Data Science → Databases and SQL for Data Science (265) |
| Git & Version Control | Advanced SQL | 265 | 14 | 0.950 | 279 | 1 | Tools for Data Science → Databases and SQL for Data Science (265) |
| Feature Engineering | Computer Vision | 264 | 92 | 0.742 | 356 | 5 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| scikit-learn | Computer Vision | 261 | 37 | 0.876 | 298 | 3 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Cloud Fundamentals | Monitoring & Observability | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Identity & Access Management | Monitoring & Observability | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Kubernetes | Identity & Access Management | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Kubernetes | Monitoring & Observability | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Prompt Engineering | Identity & Access Management | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Prompt Engineering | Monitoring & Observability | 258 | 29 | 0.899 | 287 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Essential Google Cloud Infrastructure: Core Services (258) |
| Kubernetes | Infrastructure as Code | 246 | 16 | 0.939 | 262 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| Prompt Engineering | Infrastructure as Code | 246 | 16 | 0.939 | 262 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Elastic Google Cloud Infrastructure: Scaling and Automation (246) |
| SQL | Data Storytelling | 243 | 156 | 0.609 | 399 | 3 | Databases and SQL for Data Science → Data Visualization with Python (156) |
| Advanced SQL | Data Storytelling | 242 | 26 | 0.903 | 268 | 2 | Databases and SQL for Data Science → Data Visualization with Python (156) |
| Advanced SQL | Data Visualization | 242 | 26 | 0.903 | 268 | 2 | Databases and SQL for Data Science → Data Visualization with Python (156) |
| Computer Vision | Time Series Analysis | 242 | 16 | 0.938 | 258 | 2 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Sequences, Time Series and Prediction (141) |
| SQL | Model Evaluation | 237 | 226 | 0.512 | 463 | 4 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| SQL | scikit-learn | 237 | 226 | 0.512 | 463 | 4 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Feature Engineering | Neural Networks | 236 | 159 | 0.597 | 395 | 6 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Python for Data Analysis | SQL | 235 | 91 | 0.721 | 326 | 3 | Python for Data Science and AI → Applied Data Science Capstone (122) |
| SQL | Supervised Learning | 233 | 115 | 0.670 | 348 | 3 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Advanced SQL | Model Evaluation | 226 | 14 | 0.942 | 240 | 2 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Advanced SQL | scikit-learn | 226 | 14 | 0.942 | 240 | 2 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Advanced SQL | Supervised Learning | 226 | 14 | 0.942 | 240 | 2 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Git & Version Control | Machine Learning Fundamentals | 210 | 43 | 0.830 | 253 | 3 | Tools for Data Science → Machine Learning with Python (178) |
| Neural Networks | Time Series Analysis | 208 | 20 | 0.912 | 228 | 2 | Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning → Sequences, Time Series and Prediction (141) |
| Git & Version Control | Unsupervised Learning | 206 | 18 | 0.920 | 224 | 2 | Tools for Data Science → Machine Learning with Python (178) |
| Exploratory Data Analysis | Machine Learning Fundamentals | 202 | 124 | 0.620 | 326 | 2 | Data Analysis with Python → Machine Learning with Python (195) |
| Exploratory Data Analysis | Unsupervised Learning | 202 | 124 | 0.620 | 326 | 2 | Data Analysis with Python → Machine Learning with Python (195) |
| Model Evaluation | Unsupervised Learning | 202 | 124 | 0.620 | 326 | 2 | Data Analysis with Python → Machine Learning with Python (195) |
| scikit-learn | Unsupervised Learning | 202 | 124 | 0.620 | 326 | 2 | Data Analysis with Python → Machine Learning with Python (195) |
| scikit-learn | Neural Networks | 200 | 31 | 0.866 | 231 | 2 | Machine Learning → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (180) |
| Working with APIs | Machine Learning Fundamentals | 195 | 152 | 0.562 | 347 | 3 | Python for Data Science and AI → Machine Learning with Python (184) |
| Working with APIs | Unsupervised Learning | 195 | 152 | 0.562 | 347 | 3 | Python for Data Science and AI → Machine Learning with Python (184) |
| Programming Basics | Command Line & Linux Basics | 192 | 3 | 0.985 | 195 | 1 | Crash Course on Python → Using Python to Interact with the Operating System (192) |
| Programming Basics | Shell Scripting | 192 | 3 | 0.985 | 195 | 1 | Crash Course on Python → Using Python to Interact with the Operating System (192) |
| Python | Command Line & Linux Basics | 192 | 3 | 0.985 | 195 | 1 | Crash Course on Python → Using Python to Interact with the Operating System (192) |
| Python | Shell Scripting | 192 | 3 | 0.985 | 195 | 1 | Crash Course on Python → Using Python to Interact with the Operating System (192) |
| Python | Unit Testing | 192 | 3 | 0.985 | 195 | 1 | Crash Course on Python → Using Python to Interact with the Operating System (192) |
| Data Structures | Machine Learning Fundamentals | 188 | 51 | 0.787 | 239 | 2 | Python for Data Science and AI → Machine Learning with Python (184) |
| Data Structures | Unsupervised Learning | 188 | 51 | 0.787 | 239 | 2 | Python for Data Science and AI → Machine Learning with Python (184) |
| Object-Oriented Programming | Machine Learning Fundamentals | 188 | 51 | 0.787 | 239 | 2 | Python for Data Science and AI → Machine Learning with Python (184) |
| Object-Oriented Programming | Unsupervised Learning | 188 | 51 | 0.787 | 239 | 2 | Python for Data Science and AI → Machine Learning with Python (184) |
| Cloud Fundamentals | Microservices | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Cloud Fundamentals | Site Reliability Engineering | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Collaborative Git Workflows | Machine Learning Fundamentals | 182 | 39 | 0.824 | 221 | 2 | Tools for Data Science → Machine Learning with Python (178) |
| Kubernetes | Cloud Architecture | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Kubernetes | Cloud Security | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Kubernetes | Microservices | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Kubernetes | Site Reliability Engineering | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Prompt Engineering | Cloud Architecture | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Prompt Engineering | Cloud Security | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Prompt Engineering | Microservices | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Prompt Engineering | Site Reliability Engineering | 182 | 12 | 0.938 | 194 | 1 | Google Cloud Platform Fundamentals: Core Infrastructure → Reliable Google Cloud Infrastructure: Design and Process (182) |
| Supervised Learning | Natural Language Processing | 179 | 45 | 0.799 | 224 | 5 | Machine Learning Foundations: A Case Study Approach → Sequence Models (62) |
| Collaborative Git Workflows | Unsupervised Learning | 178 | 14 | 0.927 | 192 | 1 | Tools for Data Science → Machine Learning with Python (178) |
| Data Storytelling | Machine Learning Fundamentals | 176 | 119 | 0.597 | 295 | 2 | Data Visualization with Python → Machine Learning with Python (169) |
| Data Storytelling | Unsupervised Learning | 176 | 119 | 0.597 | 295 | 2 | Data Visualization with Python → Machine Learning with Python (169) |
| Monitoring & Observability | Infrastructure as Code | 161 | 4 | 0.976 | 165 | 1 | Essential Google Cloud Infrastructure: Core Services → Elastic Google Cloud Infrastructure: Scaling and Automation (161) |
| Debugging | Networking & How the Web Works | 154 | 21 | 0.880 | 175 | 2 | R Programming → Technical Support Fundamentals (98) |
| R Programming | Networking & How the Web Works | 154 | 21 | 0.880 | 175 | 2 | R Programming → Technical Support Fundamentals (98) |
| SQL | Machine Learning Fundamentals | 147 | 113 | 0.565 | 260 | 2 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| SQL | Unsupervised Learning | 147 | 113 | 0.565 | 260 | 2 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Data Visualization | Feature Engineering | 146 | 45 | 0.764 | 191 | 2 | Applied Plotting, Charting & Data Representation in Python → Applied Machine Learning in Python (143) |
| CSS | Algorithms | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| CSS | Debugging | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| CSS | Java | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| CSS | Programming Basics | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| HTML | Algorithms | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| HTML | Debugging | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| HTML | Java | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| HTML | Programming Basics | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| JavaScript | Algorithms | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| JavaScript | Debugging | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| JavaScript | Java | 141 | 16 | 0.898 | 157 | 1 | Programming Foundations with JavaScript, HTML and CSS → Java Programming: Solving Problems with Software (141) |
| Machine Learning Fundamentals | Networking & How the Web Works | 141 | 13 | 0.916 | 154 | 2 | Machine Learning Foundations: A Case Study Approach → Technical Support Fundamentals (91) |
| Supervised Learning | Networking & How the Web Works | 141 | 37 | 0.792 | 178 | 3 | Machine Learning Foundations: A Case Study Approach → Technical Support Fundamentals (91) |
| Advanced SQL | Machine Learning Fundamentals | 140 | 12 | 0.921 | 152 | 1 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Advanced SQL | Unsupervised Learning | 140 | 12 | 0.921 | 152 | 1 | Databases and SQL for Data Science → Machine Learning with Python (140) |
| Probability | Spreadsheets | 134 | 12 | 0.918 | 146 | 1 | Fundamentals of Quantitative Modeling → Introduction to Spreadsheets and Models (134) |
| Model Evaluation | Time Series Analysis | 124 | 19 | 0.867 | 143 | 2 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Sequences, Time Series and Prediction (67) |
| Object-Oriented Programming | SQL | 122 | 1 | 0.992 | 123 | 1 | Python for Data Science and AI → Applied Data Science Capstone (122) |
| Unsupervised Learning | Deep Learning | 118 | 16 | 0.881 | 134 | 3 | Machine Learning Foundations: A Case Study Approach → Sequence Models (62) |
| Feature Engineering | Natural Language Processing | 117 | 38 | 0.755 | 155 | 4 | Machine Learning → Natural Language Processing in TensorFlow (55) |
| Data Cleaning | Exploratory Data Analysis | 115 | 115 | 0.500 | 230 | 1 | Data Analysis with Python → Applied Data Science Capstone (111) |
| Data Cleaning | SQL | 113 | 90 | 0.557 | 203 | 2 | Data Analysis with Python → Applied Data Science Capstone (111) |
| Exploratory Data Analysis | SQL | 113 | 90 | 0.557 | 203 | 2 | Data Analysis with Python → Applied Data Science Capstone (111) |
| Responsive Design | React | 113 | 9 | 0.926 | 122 | 1 | Front-End Web UI Frameworks and Tools: Bootstrap 4 → Front-End Web Development with React (113) |
| Model Evaluation | Feature Engineering | 107 | 3 | 0.973 | 110 | 3 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Natural Language Processing with Classification and Vector Spaces (42) |
| Infrastructure as Code | Cloud Architecture | 106 | 4 | 0.964 | 110 | 1 | Elastic Google Cloud Infrastructure: Scaling and Automation → Reliable Google Cloud Infrastructure: Design and Process (106) |
| Infrastructure as Code | Cloud Security | 106 | 4 | 0.964 | 110 | 1 | Elastic Google Cloud Infrastructure: Scaling and Automation → Reliable Google Cloud Infrastructure: Design and Process (106) |
| Infrastructure as Code | Microservices | 106 | 4 | 0.964 | 110 | 1 | Elastic Google Cloud Infrastructure: Scaling and Automation → Reliable Google Cloud Infrastructure: Design and Process (106) |
| Infrastructure as Code | Site Reliability Engineering | 106 | 4 | 0.964 | 110 | 1 | Elastic Google Cloud Infrastructure: Scaling and Automation → Reliable Google Cloud Infrastructure: Design and Process (106) |
| Monitoring & Observability | Cloud Architecture | 102 | 7 | 0.936 | 109 | 1 | Essential Google Cloud Infrastructure: Core Services → Reliable Google Cloud Infrastructure: Design and Process (102) |
| Monitoring & Observability | Cloud Security | 102 | 7 | 0.936 | 109 | 1 | Essential Google Cloud Infrastructure: Core Services → Reliable Google Cloud Infrastructure: Design and Process (102) |
| Monitoring & Observability | Microservices | 102 | 7 | 0.936 | 109 | 1 | Essential Google Cloud Infrastructure: Core Services → Reliable Google Cloud Infrastructure: Design and Process (102) |
| Unsupervised Learning | Supervised Learning | 101 | 7 | 0.935 | 108 | 1 | Machine Learning with Python → Applied Data Science Capstone (101) |
| Recommender Systems | Deep Learning | 98 | 13 | 0.883 | 111 | 2 | Machine Learning Foundations: A Case Study Approach → Sequence Models (62) |
| Model Evaluation | Networking & How the Web Works | 91 | 31 | 0.746 | 122 | 2 | Machine Learning Foundations: A Case Study Approach → Technical Support Fundamentals (91) |
| Advanced Python | Collaborative Git Workflows | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Advanced Python | Git & Version Control | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Recommender Systems | Networking & How the Web Works | 91 | 7 | 0.929 | 98 | 1 | Machine Learning Foundations: A Case Study Approach → Technical Support Fundamentals (91) |
| Regular Expressions | Collaborative Git Workflows | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Regular Expressions | Git & Version Control | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Shell Scripting | Collaborative Git Workflows | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Shell Scripting | Git & Version Control | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Unit Testing | Collaborative Git Workflows | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Unit Testing | Git & Version Control | 91 | 11 | 0.892 | 102 | 1 | Using Python to Interact with the Operating System → Introduction to Git and GitHub (91) |
| Unsupervised Learning | Networking & How the Web Works | 91 | 7 | 0.929 | 98 | 1 | Machine Learning Foundations: A Case Study Approach → Technical Support Fundamentals (91) |
| Natural Language Processing | Time Series Analysis | 89 | 5 | 0.947 | 94 | 1 | Natural Language Processing in TensorFlow → Sequences, Time Series and Prediction (89) |
| Advanced SQL | Working with APIs | 86 | 2 | 0.977 | 88 | 1 | Databases and SQL for Data Science → Applied Data Science Capstone (86) |
| Advanced SQL | Data Cleaning | 86 | 2 | 0.977 | 88 | 1 | Databases and SQL for Data Science → Applied Data Science Capstone (86) |
| Advanced SQL | Exploratory Data Analysis | 86 | 2 | 0.977 | 88 | 1 | Databases and SQL for Data Science → Applied Data Science Capstone (86) |
| Advanced SQL | Python for Data Analysis | 86 | 2 | 0.977 | 88 | 1 | Databases and SQL for Data Science → Applied Data Science Capstone (86) |
| Feature Engineering | Identity & Access Management | 85 | 12 | 0.876 | 97 | 2 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| Machine Learning Fundamentals | Identity & Access Management | 85 | 12 | 0.876 | 97 | 2 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| scikit-learn | Identity & Access Management | 85 | 12 | 0.876 | 97 | 2 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| scikit-learn | Natural Language Processing | 85 | 9 | 0.904 | 94 | 2 | Machine Learning → Natural Language Processing in TensorFlow (55) |
| Supervised Learning | Identity & Access Management | 85 | 12 | 0.876 | 97 | 2 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| R Programming | Programming Basics | 81 | 13 | 0.862 | 94 | 2 | R Programming → Python for Data Science and AI (45) |
| R Programming | Python | 81 | 13 | 0.862 | 94 | 2 | R Programming → Python for Data Science and AI (45) |
| Big Data Fundamentals | Cloud Data Platforms | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Big Data Fundamentals | Data Warehousing | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Google Cloud Fundamentals | Cloud Data Platforms | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Google Cloud Fundamentals | Data Lakes & Lakehouses | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Google Cloud Fundamentals | Data Warehousing | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Machine Learning Fundamentals | Cloud Data Platforms | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Machine Learning Fundamentals | Data Lakes & Lakehouses | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| Machine Learning Fundamentals | Data Warehousing | 76 | 2 | 0.974 | 78 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Modernizing Data Lakes and Data Warehouses with GCP (76) |
| R Programming | Command Line & Linux Basics | 68 | 11 | 0.861 | 79 | 2 | The Data Scientist’s Toolbox → Operating Systems and You: Becoming a Power User (38) |
| R Programming | Linux Administration | 68 | 11 | 0.861 | 79 | 2 | The Data Scientist’s Toolbox → Operating Systems and You: Becoming a Power User (38) |
| Feature Engineering | Command Line & Linux Basics | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| Feature Engineering | Linux Administration | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| Machine Learning Fundamentals | Command Line & Linux Basics | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| Machine Learning Fundamentals | Linux Administration | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| scikit-learn | Command Line & Linux Basics | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| scikit-learn | Linux Administration | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| Supervised Learning | Command Line & Linux Basics | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| Supervised Learning | Linux Administration | 66 | 11 | 0.857 | 77 | 1 | Machine Learning → Operating Systems and You: Becoming a Power User (66) |
| R Programming | Computer Vision | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| R Programming | Deep Learning | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| R Programming | Neural Networks | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| R Programming | TensorFlow & Keras | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| Git & Version Control | Computer Vision | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| Git & Version Control | Deep Learning | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| Git & Version Control | Neural Networks | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| Git & Version Control | TensorFlow & Keras | 64 | 11 | 0.853 | 75 | 1 | The Data Scientist’s Toolbox → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (64) |
| Recommender Systems | Natural Language Processing | 62 | 7 | 0.899 | 69 | 1 | Machine Learning Foundations: A Case Study Approach → Sequence Models (62) |
| Unsupervised Learning | Natural Language Processing | 62 | 7 | 0.899 | 69 | 1 | Machine Learning Foundations: A Case Study Approach → Sequence Models (62) |
| R Programming | Feature Engineering | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| R Programming | Machine Learning Fundamentals | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| R Programming | Model Evaluation | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| R Programming | scikit-learn | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| R Programming | Supervised Learning | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| R Programming | Unsupervised Learning | 56 | 8 | 0.875 | 64 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| Unsupervised Learning | Computer Vision | 56 | 9 | 0.862 | 65 | 2 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Unsupervised Learning | Neural Networks | 56 | 9 | 0.862 | 65 | 2 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Unsupervised Learning | TensorFlow & Keras | 56 | 9 | 0.862 | 65 | 2 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Feature Engineering | Reinforcement Learning | 55 | 1 | 0.982 | 56 | 2 | Machine Learning → Fundamentals of Reinforcement Learning (34) |
| Feature Engineering | Time Series Analysis | 55 | 7 | 0.887 | 62 | 1 | Machine Learning → Sequences, Time Series and Prediction (55) |
| Machine Learning Fundamentals | Time Series Analysis | 55 | 7 | 0.887 | 62 | 1 | Machine Learning → Sequences, Time Series and Prediction (55) |
| Networking & How the Web Works | Data Storytelling | 55 | 3 | 0.948 | 58 | 2 | Using Python to Access Web Data → Data Visualization with Python (31) |
| Regular Expressions | Data Storytelling | 55 | 3 | 0.948 | 58 | 2 | Using Python to Access Web Data → Data Visualization with Python (31) |
| scikit-learn | Reinforcement Learning | 55 | 1 | 0.982 | 56 | 2 | Machine Learning → Fundamentals of Reinforcement Learning (34) |
| scikit-learn | Time Series Analysis | 55 | 7 | 0.887 | 62 | 1 | Machine Learning → Sequences, Time Series and Prediction (55) |
| Supervised Learning | Reinforcement Learning | 55 | 1 | 0.982 | 56 | 2 | Machine Learning → Fundamentals of Reinforcement Learning (34) |
| Supervised Learning | Time Series Analysis | 55 | 7 | 0.887 | 62 | 1 | Machine Learning → Sequences, Time Series and Prediction (55) |
| Command Line & Linux Basics | Debugging | 54 | 34 | 0.614 | 88 | 2 | Using Python to Interact with the Operating System → Troubleshooting and Debugging Techniques (49) |
| Collaborative Git Workflows | Debugging | 53 | 3 | 0.946 | 56 | 1 | Introduction to Git and GitHub → Troubleshooting and Debugging Techniques (53) |
| Model Evaluation | Reinforcement Learning | 52 | 7 | 0.881 | 59 | 2 | Structuring Machine Learning Projects → Fundamentals of Reinforcement Learning (27) |
| AWS Fundamentals | Cloud Security | 51 | 2 | 0.962 | 53 | 1 | AWS Fundamentals: Going Cloud-Native → AWS Fundamentals: Addressing Security Risk (51) |
| Identity & Access Management | Compliance & Privacy | 51 | 4 | 0.927 | 55 | 1 | Introduction to Cybersecurity Tools & Cyber Attacks → Cybersecurity Compliance Framework & System Administration (51) |
| Network Security | Compliance & Privacy | 51 | 4 | 0.927 | 55 | 1 | Introduction to Cybersecurity Tools & Cyber Attacks → Cybersecurity Compliance Framework & System Administration (51) |
| Feature Engineering | Cloud Fundamentals | 50 | 6 | 0.893 | 56 | 1 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| Feature Engineering | Networking & How the Web Works | 50 | 6 | 0.893 | 56 | 1 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| Machine Learning Fundamentals | Cloud Fundamentals | 50 | 6 | 0.893 | 56 | 1 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| scikit-learn | Cloud Fundamentals | 50 | 6 | 0.893 | 56 | 1 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| scikit-learn | Networking & How the Web Works | 50 | 30 | 0.625 | 80 | 2 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| Supervised Learning | Cloud Fundamentals | 50 | 6 | 0.893 | 56 | 1 | Machine Learning → System Administration and IT Infrastructure Services (50) |
| Advanced Python | Debugging | 49 | 4 | 0.925 | 53 | 1 | Using Python to Interact with the Operating System → Troubleshooting and Debugging Techniques (49) |
| Regular Expressions | Debugging | 49 | 4 | 0.925 | 53 | 1 | Using Python to Interact with the Operating System → Troubleshooting and Debugging Techniques (49) |
| Shell Scripting | Debugging | 49 | 4 | 0.925 | 53 | 1 | Using Python to Interact with the Operating System → Troubleshooting and Debugging Techniques (49) |
| Unit Testing | Debugging | 49 | 4 | 0.925 | 53 | 1 | Using Python to Interact with the Operating System → Troubleshooting and Debugging Techniques (49) |
| Big Data Fundamentals | Data Quality & Governance | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Big Data Fundamentals | ETL & Data Pipelines | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Debugging | Working with APIs | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| Debugging | Object-Oriented Programming | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| Debugging | Python for Data Analysis | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| Google Cloud Fundamentals | Apache Spark | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Google Cloud Fundamentals | Data Quality & Governance | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Google Cloud Fundamentals | ETL & Data Pipelines | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Machine Learning Fundamentals | Apache Spark | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Machine Learning Fundamentals | Data Quality & Governance | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| Machine Learning Fundamentals | ETL & Data Pipelines | 45 | 2 | 0.957 | 47 | 1 | Google Cloud Platform Big Data and Machine Learning Fundamentals → Building Batch Data Pipelines on GCP (45) |
| R Programming | Working with APIs | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| R Programming | Data Structures | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| R Programming | Object-Oriented Programming | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| R Programming | Python for Data Analysis | 45 | 7 | 0.865 | 52 | 1 | R Programming → Python for Data Science and AI (45) |
| Cloud Fundamentals | Compliance & Privacy | 44 | 3 | 0.936 | 47 | 1 | Cybersecurity Roles, Processes & Operating System Security → Cybersecurity Compliance Framework & System Administration (44) |
| Command Line & Linux Basics | Compliance & Privacy | 44 | 3 | 0.936 | 47 | 1 | Cybersecurity Roles, Processes & Operating System Security → Cybersecurity Compliance Framework & System Administration (44) |
| Linux Administration | Compliance & Privacy | 44 | 3 | 0.936 | 47 | 1 | Cybersecurity Roles, Processes & Operating System Security → Cybersecurity Compliance Framework & System Administration (44) |
| Git & Version Control | Linux Administration | 41 | 26 | 0.612 | 67 | 2 | The Data Scientist’s Toolbox → Operating Systems and You: Becoming a Power User (38) |
| JavaScript | Responsive Design | 40 | 7 | 0.851 | 47 | 1 | HTML, CSS, and Javascript for Web Developers → Front-End Web UI Frameworks and Tools: Bootstrap 4 (40) |
| Functional Programming | Networking & How the Web Works | 38 | 5 | 0.884 | 43 | 1 | Functional Programming Principles in Scala → Technical Support Fundamentals (38) |
| Recommender Systems | Computer Vision | 36 | 6 | 0.857 | 42 | 1 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Recommender Systems | Neural Networks | 36 | 6 | 0.857 | 42 | 1 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Recommender Systems | TensorFlow & Keras | 36 | 6 | 0.857 | 42 | 1 | Machine Learning Foundations: A Case Study Approach → Introduction to TensorFlow for Artificial Intelligence, Machine Learning, and Deep Learning (36) |
| Cloud Data Platforms | Apache Spark | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Cloud Data Platforms | Data Quality & Governance | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Data Lakes & Lakehouses | Apache Spark | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Data Lakes & Lakehouses | Data Quality & Governance | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Data Lakes & Lakehouses | ETL & Data Pipelines | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Data Warehousing | Apache Spark | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Data Warehousing | Data Quality & Governance | 35 | 3 | 0.921 | 38 | 1 | Modernizing Data Lakes and Data Warehouses with GCP → Building Batch Data Pipelines on GCP (35) |
| Feature Engineering | Network Security | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Feature Engineering | Security Fundamentals | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Machine Learning Fundamentals | Network Security | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Machine Learning Fundamentals | Security Fundamentals | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Probability | Networking & How the Web Works | 35 | 6 | 0.854 | 41 | 1 | Fundamentals of Quantitative Modeling → Technical Support Fundamentals (35) |
| scikit-learn | Network Security | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| scikit-learn | Security Fundamentals | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Supervised Learning | Network Security | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Supervised Learning | Security Fundamentals | 35 | 6 | 0.854 | 41 | 1 | Machine Learning → Introduction to Cybersecurity Tools & Cyber Attacks (35) |
| Computer Vision | Data Cleaning | 33 | 1 | 0.971 | 34 | 1 | AI for Medical Diagnosis → AI for Medical Prognosis (33) |
| Deep Learning | Data Cleaning | 33 | 1 | 0.971 | 34 | 1 | AI for Medical Diagnosis → AI for Medical Prognosis (33) |
| Git & Version Control | Feature Engineering | 32 | 29 | 0.525 | 61 | 2 | The Data Scientist’s Toolbox → Applied Machine Learning in Python (28) |
| Debugging | Algorithms | 31 | 2 | 0.939 | 33 | 1 | Object-Oriented Data Structures in C++ → Ordered Data Structures (31) |
| Object-Oriented Programming | Algorithms | 31 | 2 | 0.939 | 33 | 1 | Object-Oriented Data Structures in C++ → Ordered Data Structures (31) |
| Debugging | Linux Administration | 30 | 5 | 0.857 | 35 | 1 | R Programming → Operating Systems and You: Becoming a Power User (30) |
| HTML | Networking & How the Web Works | 30 | 5 | 0.857 | 35 | 1 | Introduction to HTML5 → Technical Support Fundamentals (30) |
| scikit-learn | Feature Engineering | 30 | 0 | 1.000 | 30 | 1 | Machine Learning → Natural Language Processing with Classification and Vector Spaces (30) |
| Web Accessibility | Networking & How the Web Works | 30 | 5 | 0.857 | 35 | 1 | Introduction to HTML5 → Technical Support Fundamentals (30) |
| Model Evaluation | Command Line & Linux Basics | 29 | 5 | 0.853 | 34 | 1 | Structuring Machine Learning Projects → Operating Systems and You: Becoming a Power User (29) |
| Model Evaluation | Linux Administration | 29 | 5 | 0.853 | 34 | 1 | Structuring Machine Learning Projects → Operating Systems and You: Becoming a Power User (29) |
| Debugging | Feature Engineering | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Debugging | Machine Learning Fundamentals | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Debugging | Model Evaluation | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Debugging | scikit-learn | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Debugging | Supervised Learning | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Debugging | Unsupervised Learning | 28 | 4 | 0.875 | 32 | 1 | R Programming → Applied Machine Learning in Python (28) |
| Recommender Systems | Working with APIs | 26 | 4 | 0.867 | 30 | 1 | Machine Learning Foundations: A Case Study Approach → Python for Data Science and AI (26) |
| Recommender Systems | Data Structures | 26 | 4 | 0.867 | 30 | 1 | Machine Learning Foundations: A Case Study Approach → Python for Data Science and AI (26) |
| Recommender Systems | Object-Oriented Programming | 26 | 4 | 0.867 | 30 | 1 | Machine Learning Foundations: A Case Study Approach → Python for Data Science and AI (26) |
| Recommender Systems | Python for Data Analysis | 26 | 4 | 0.867 | 30 | 1 | Machine Learning Foundations: A Case Study Approach → Python for Data Science and AI (26) |
| Feature Engineering | Collaborative Git Workflows | 25 | 4 | 0.862 | 29 | 1 | Machine Learning → Introduction to Git and GitHub (25) |
| Feature Engineering | Probability | 25 | 3 | 0.893 | 28 | 1 | Machine Learning → Python and Statistics for Financial Analysis (25) |
| Machine Learning Fundamentals | Probability | 25 | 3 | 0.893 | 28 | 1 | Machine Learning → Python and Statistics for Financial Analysis (25) |
| scikit-learn | Probability | 25 | 3 | 0.893 | 28 | 1 | Machine Learning → Python and Statistics for Financial Analysis (25) |
| Supervised Learning | Probability | 25 | 3 | 0.893 | 28 | 1 | Machine Learning → Python and Statistics for Financial Analysis (25) |
| TensorFlow & Keras | Reinforcement Learning | 25 | 4 | 0.862 | 29 | 1 | Improving Deep Neural Networks: Hyperparameter tuning, Regularization and Optimization → Fundamentals of Reinforcement Learning (25) |
| Data Modeling | Data Visualization | 24 | 3 | 0.889 | 27 | 1 | Using Databases with Python → Applied Plotting, Charting & Data Representation in Python (24) |
| Networking & How the Web Works | Exploratory Data Analysis | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Networking & How the Web Works | Python for Data Analysis | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Regular Expressions | Exploratory Data Analysis | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Regular Expressions | Model Evaluation | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Regular Expressions | Python for Data Analysis | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Regular Expressions | scikit-learn | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| Regular Expressions | Supervised Learning | 24 | 0 | 1.000 | 24 | 1 | Using Python to Access Web Data → Applied Data Science Capstone (24) |
| R Programming | LLM Fundamentals | 23 | 4 | 0.852 | 27 | 1 | The Data Scientist’s Toolbox → Introduction to Artificial Intelligence (AI) (23) |
| R Programming | Responsible AI | 23 | 4 | 0.852 | 27 | 1 | The Data Scientist’s Toolbox → Introduction to Artificial Intelligence (AI) (23) |
| Git & Version Control | LLM Fundamentals | 23 | 4 | 0.852 | 27 | 1 | The Data Scientist’s Toolbox → Introduction to Artificial Intelligence (AI) (23) |
| Git & Version Control | Responsible AI | 23 | 4 | 0.852 | 27 | 1 | The Data Scientist’s Toolbox → Introduction to Artificial Intelligence (AI) (23) |
| Debugging | Spreadsheets | 22 | 2 | 0.917 | 24 | 1 | R Programming → Excel Skills for Business: Intermediate I (22) |
| Programming Basics | Spreadsheets | 22 | 2 | 0.917 | 24 | 1 | Programming for Everybody (Getting Started with Python) → Everyday Excel, Part 1 (22) |
| Python | Spreadsheets | 22 | 2 | 0.917 | 24 | 1 | Programming for Everybody (Getting Started with Python) → Everyday Excel, Part 1 (22) |
| R Programming | Spreadsheets | 22 | 2 | 0.917 | 24 | 1 | R Programming → Excel Skills for Business: Intermediate I (22) |
| Big Data Fundamentals | Google Cloud Fundamentals | 20 | 2 | 0.909 | 22 | 1 | Introduction to Big Data → Google Cloud Platform Big Data and Machine Learning Fundamentals (20) |
| Big Data Fundamentals | Machine Learning Fundamentals | 20 | 2 | 0.909 | 22 | 1 | Introduction to Big Data → Google Cloud Platform Big Data and Machine Learning Fundamentals (20) |
| Debugging | Cryptography Basics | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| Debugging | Identity & Access Management | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| Debugging | Network Security | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| Debugging | Security Fundamentals | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| Inferential Statistics | R Programming | 20 | 1 | 0.952 | 21 | 1 | Bayesian Statistics: From Concept to Data Analysis → Bayesian Statistics: Techniques and Models (20) |
| Linux Administration | Collaborative Git Workflows | 20 | 3 | 0.870 | 23 | 1 | Operating Systems and You: Becoming a Power User → Introduction to Git and GitHub (20) |
| Probability | R Programming | 20 | 1 | 0.952 | 21 | 1 | Bayesian Statistics: From Concept to Data Analysis → Bayesian Statistics: Techniques and Models (20) |
| R Programming | Cryptography Basics | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| R Programming | Identity & Access Management | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| R Programming | Network Security | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
| R Programming | Security Fundamentals | 20 | 2 | 0.909 | 22 | 1 | R Programming → IT Security: Defense against the digital dark arts (20) |
